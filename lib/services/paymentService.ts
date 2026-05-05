import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { PublicKey } from '@solana/web3.js';
import { transferSol } from '@/lib/solana/transferSol';
import { getConnection, lamportsToSol, solToLamports } from '@/lib/solana/connection';
import { createPendingOrder, markOrderPaid, markOrderStatus } from './orderService';
import { getProfile } from './profileService';
import { formatSol } from '@/lib/utils/formatNumber';
import type { OrderType } from '@/types/marketplace';

// Generous fee buffer for a SystemProgram.transfer. Real fee is ~5000 lamports
// (0.000005 SOL); we reserve 0.0001 SOL so the user isn't blocked by transient
// priority-fee bumps and small slippage between balance fetch and tx send.
const FEE_BUFFER_SOL = 0.0001;
const FEE_BUFFER_LAMPORTS = solToLamports(FEE_BUFFER_SOL);

export interface PayInput {
    type: OrderType;
    referenceId: string;
    sellerId: string;
    amountSol: number;
    buyerWalletAddress: string;
    walletProvider: PrivyEmbeddedSolanaWalletProvider;
}

export interface PayResult {
    orderId: string;
    signature: string;
}

/**
 * End-to-end payment for a marketplace transaction.
 *
 * 1. Resolve the seller's Solana wallet address (from their profile).
 * 2. Preflight: confirm buyer balance covers amount + fee buffer.
 * 3. Create a `pending` order doc *before* sending so we have a record of intent.
 * 4. Sign + send a SOL transfer from the buyer's embedded wallet.
 * 5. Mark the order `paid` with the on-chain signature on success, or `failed`
 *    on transfer failure (so the inbox doesn't accumulate ghost pendings).
 */
export async function payForListing(input: PayInput): Promise<PayResult> {
    const sellerProfile = await getProfile(input.sellerId);
    if (!sellerProfile?.walletAddress) {
        throw new Error('Seller has no Solana wallet address. Cannot send payment.');
    }

    // Preflight balance check — surface a useful "Insufficient SOL" message
    // before we write a doc or hit Privy. Errors fetching balance are
    // non-fatal; we let the on-chain attempt produce the real error.
    try {
        const balanceLamports = await getConnection().getBalance(
            new PublicKey(input.buyerWalletAddress),
        );
        const requiredLamports = solToLamports(input.amountSol) + FEE_BUFFER_LAMPORTS;
        if (balanceLamports < requiredLamports) {
            const have = formatSol(lamportsToSol(balanceLamports));
            const need = formatSol(input.amountSol + FEE_BUFFER_SOL);
            throw new Error(
                `Insufficient SOL — your balance is ${have}, you need at least ${need} (includes ~${formatSol(FEE_BUFFER_SOL)} for fees).`,
            );
        }
    } catch (err: any) {
        // Re-throw our own preflight error; swallow other RPC errors so the
        // transfer call below still gets a chance to surface its real reason.
        if (typeof err?.message === 'string' && err.message.startsWith('Insufficient SOL')) {
            throw err;
        }
    }

    const orderId = await createPendingOrder({
        type: input.type,
        referenceId: input.referenceId,
        sellerId: input.sellerId,
        amountSol: input.amountSol,
    });

    let signature: string;
    try {
        signature = await transferSol({
            provider: input.walletProvider,
            fromAddress: input.buyerWalletAddress,
            toAddress: sellerProfile.walletAddress,
            amountSol: input.amountSol,
        });
    } catch (err) {
        // Mark the order failed so it doesn't pollute the buyer's inbox as a
        // perpetual `pending`. A scheduled cloud function can later re-check
        // failed orders for any tx that did land on-chain.
        await markOrderStatus(orderId, 'failed').catch(() => {});
        throw err;
    }

    await markOrderPaid(orderId, signature);
    return { orderId, signature };
}

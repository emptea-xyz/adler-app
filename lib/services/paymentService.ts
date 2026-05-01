import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/js-sdk-core';
import { transferSol } from '@/lib/solana/transferSol';
import { createPendingOrder, markOrderPaid, markOrderStatus } from './orderService';
import { getProfile } from './profileService';
import type { OrderType } from '@/types/marketplace';

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
 * 2. Create a `pending` order doc *first* so we always have a record of intent.
 * 3. Sign + send a SOL transfer from the buyer's embedded wallet.
 * 4. Mark the order `paid` with the on-chain signature.
 */
export async function payForListing(input: PayInput): Promise<PayResult> {
    const sellerProfile = await getProfile(input.sellerId);
    if (!sellerProfile?.walletAddress) {
        throw new Error('Seller has no Solana wallet address. Cannot send payment.');
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
        // Best-effort: leave the order in `pending` so it can be reconciled or
        // retried later. The cloud reconciler (v2) will clean stale pendings.
        await markOrderStatus(orderId, 'pending').catch(() => {});
        throw err;
    }

    await markOrderPaid(orderId, signature);
    return { orderId, signature };
}

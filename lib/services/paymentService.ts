// Legacy direct-transfer payment path. Writes v1-shaped order docs but
// without the on-chain Anchor escrow — txSignature is the
// SystemProgram.transfer signature, contractId32 / escrowPda are null.
//
// This whole module is replaced in step 4 with the BuyAction state
// machine in `components/features/marketplace/BuyAction.tsx` (escrow
// fund_service → markOrderPaid). Until then it keeps the legacy buy CTAs
// in checkout.tsx / gig/[id].tsx working.

import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { PublicKey } from '@solana/web3.js';
import * as Crypto from 'expo-crypto';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { transferSol } from '@/lib/solana/transferSol';
import { getConnection, lamportsToSol, solToLamports } from '@/lib/solana/connection';
import { markOrderPaid, markOrderFailed } from '@/lib/services/ordersService';
import { getProfile } from '@/lib/services/profileService';
import { createOrderThread } from '@/lib/services/threadsService';
import { formatSol } from '@/lib/utils/formatNumber';
import type { OrderType } from '@/types/marketplace';

const ORDERS = 'orders';

// Generous fee buffer for a SystemProgram.transfer. Real fee is ~5000
// lamports (0.000005 SOL); we reserve 0.0001 SOL so the user isn't
// blocked by transient priority-fee bumps and small slippage between
// balance fetch and tx send.
const FEE_BUFFER_SOL = 0.0001;
const FEE_BUFFER_LAMPORTS = solToLamports(FEE_BUFFER_SOL);

export interface PayInput {
    type: OrderType;
    /** Listing the order is being placed against (service id or gig id). */
    listingId: string;
    /** Optional denorm written into the order doc for inbox rendering. */
    listingTitle?: string | null;
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
 * End-to-end payment for a marketplace transaction (legacy direct-transfer).
 *
 * 1. Resolve the seller's Solana wallet address (from their profile).
 * 2. Preflight: confirm buyer balance covers amount + fee buffer.
 * 3. Write a `pending` order doc *before* sending so we have a record of
 *    intent. contractId32 / escrowPda are null — these are non-escrow
 *    orders and the rule allows the fields to stay null.
 * 4. Sign + send a SOL transfer from the buyer's embedded wallet.
 * 5. Mark the order `paid` with the on-chain signature, or `failed` on
 *    transfer failure.
 */
export async function payForListing(input: PayInput): Promise<PayResult> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    if (uid === input.sellerId) throw new Error('Cannot buy your own listing');

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
        if (typeof err?.message === 'string' && err.message.startsWith('Insufficient SOL')) {
            throw err;
        }
    }

    const orderId = Crypto.randomUUID();
    await setDoc(doc(db, ORDERS, orderId), {
        buyerId: uid,
        sellerId: input.sellerId,
        status: 'pending',
        txSignature: null,
        amountSol: input.amountSol,
        feeSol: 0,
        contractId32: null,
        escrowPda: null,
        type: input.type,
        listingId: input.listingId,
        listingTitle: input.listingTitle ?? null,
        buyerHandle: null,
        buyerDisplayName: null,
        sellerHandle: sellerProfile.username ?? null,
        sellerDisplayName: sellerProfile.displayName ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    const buyerProfile = await getProfile(uid).catch(() => null);
    await createOrderThread({
        orderId,
        parentTitle: input.listingTitle ?? null,
        buyer: {
            uid,
            handle: buyerProfile?.username ?? null,
            displayName: buyerProfile?.displayName ?? null,
            avatarUrl: buyerProfile?.avatarUrl ?? null,
        },
        seller: {
            uid: input.sellerId,
            handle: sellerProfile.username ?? null,
            displayName: sellerProfile.displayName ?? null,
            avatarUrl: sellerProfile.avatarUrl ?? null,
        },
    }).catch(() => null);

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
        // perpetual `pending`. A scheduled cloud function (see plan §
        // step 4 / web's reconcilePendingOrders) sweeps any stuck orders
        // older than 1h.
        await markOrderFailed(orderId).catch(() => {});
        throw err;
    }

    await markOrderPaid(orderId, signature);
    return { orderId, signature };
}

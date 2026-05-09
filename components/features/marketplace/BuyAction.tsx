import * as Crypto from 'expo-crypto';
import type { QueryClient } from '@tanstack/react-query';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { PublicKey } from '@solana/web3.js';
import { computeFeeSol } from '@/lib/constants/featureGates';
import { qk } from '@/lib/constants/queryKeys';
import { getConnection, solToLamports } from '@/lib/solana/connection';
import { fundService } from '@/lib/escrow/fundService';
import { deriveContractEscrowPda, deriveContractId } from '@/lib/escrow/pda';
import { createOrder, markOrderFailed, markOrderPaid } from '@/lib/services/ordersService';
import { getProfile } from '@/lib/services/profileService';
import { createOrderThread } from '@/lib/services/threadsService';
import { clearPendingOrder, setPendingOrder } from '@/lib/utils/pendingOrders';
import { retryWithBackoff } from '@/lib/utils/retry';

export interface BuyActionInput {
    buyerId: string;
    buyerWalletAddress: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
    sellerId: string;
    listingId: string;
    listingTitle: string | null;
    amountSol: number;
    type: 'service' | 'gig';
    queryClient: QueryClient;
}

export async function runBuyAction(input: BuyActionInput): Promise<{ orderId: string; signature: string }> {
    const sellerProfile = await getProfile(input.sellerId);
    if (!sellerProfile?.walletAddress) throw new Error('Seller wallet missing');
    const buyerProfile = await getProfile(input.buyerId);
    const balanceLamports = await getConnection().getBalance(new PublicKey(input.buyerWalletAddress));
    const amountLamports = solToLamports(input.amountSol);
    if (balanceLamports < amountLamports) throw new Error('Insufficient SOL');

    const orderId = Crypto.randomUUID();
    const contractId = await deriveContractId(orderId);
    const escrowPda = deriveContractEscrowPda(input.buyerWalletAddress, contractId.bytes).toBase58();
    const feeSol = computeFeeSol(input.amountSol);

    await createOrder({
        orderId,
        contractId32: contractId.hex,
        escrowPda,
        sellerId: input.sellerId,
        amountSol: input.amountSol,
        feeSol,
        type: input.type,
        listingId: input.listingId,
        listingTitle: input.listingTitle,
        buyerHandle: buyerProfile?.username ?? null,
        buyerDisplayName: buyerProfile?.displayName ?? null,
        sellerHandle: sellerProfile.username ?? null,
        sellerDisplayName: sellerProfile.displayName ?? null,
    });
    await setPendingOrder(orderId, {
        escrowPda,
        signature: null,
        createdAt: Date.now(),
    });

    let signature = '';
    try {
        const funded = await fundService({
            provider: input.provider,
            fromAddress: input.buyerWalletAddress,
            creatorPubkey: sellerProfile.walletAddress,
            amountSol: input.amountSol,
        });
        signature = funded.signature;
        await setPendingOrder(orderId, {
            escrowPda,
            signature,
            createdAt: Date.now(),
        });
    } catch (err) {
        await markOrderFailed(orderId).catch(() => null);
        throw err;
    }

    await createOrderThread({
        orderId,
        parentTitle: input.listingTitle,
        buyer: {
            uid: input.buyerId,
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

    await retryWithBackoff(
        () => markOrderPaid(orderId, signature),
        { tries: 3, baseMs: 500 },
    );
    await clearPendingOrder(orderId);

    await Promise.all([
        input.queryClient.invalidateQueries({ queryKey: qk.wallet.balance(input.buyerWalletAddress) }),
        input.queryClient.invalidateQueries({ queryKey: qk.orders.byBuyer(input.buyerId) }),
        input.queryClient.invalidateQueries({ queryKey: qk.orders.bySeller(input.sellerId) }),
        input.queryClient.invalidateQueries({ queryKey: qk.threads.byParticipant(input.buyerId) }),
    ]);

    return { orderId, signature };
}

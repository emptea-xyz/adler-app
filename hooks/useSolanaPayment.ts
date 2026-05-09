import { useCallback } from 'react';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { payForListing, type PayInput, type PayResult } from '@/lib/services/paymentService';
import type { OrderType } from '@/types/marketplace';

/**
 * Wraps `payForListing` with the Privy embedded Solana wallet provider so
 * screens can call `pay({ type, listingId, sellerId, amountSol })` directly.
 *
 * Step 4 replaces this hook + paymentService with the on-chain escrow
 * flow (`fundService` + `markOrderPaid`). Until then this is the legacy
 * direct-transfer path — works against the v1 orders schema, but doesn't
 * settle through the Anchor program.
 */
export function useSolanaPayment() {
    const solana = useEmbeddedSolanaWallet();
    const wallet = solana.wallets?.[0];

    const pay = useCallback(
        async (args: {
            type: OrderType;
            listingId: string;
            listingTitle?: string | null;
            sellerId: string;
            amountSol: number;
        }): Promise<PayResult> => {
            if (!wallet) {
                throw new Error('No embedded Solana wallet available');
            }
            const provider = await wallet.getProvider();
            const input: PayInput = {
                ...args,
                buyerWalletAddress: wallet.address,
                walletProvider: provider,
            };
            return payForListing(input);
        },
        [wallet],
    );

    return {
        pay,
        walletAddress: wallet?.address ?? null,
        ready: !!wallet,
    };
}

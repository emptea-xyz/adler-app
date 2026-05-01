import { useCallback } from 'react';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { payForListing, type PayInput, type PayResult } from '@/lib/services/paymentService';
import type { OrderType } from '@/types/marketplace';

/**
 * Wraps `payForListing` with the Privy embedded Solana wallet provider so
 * screens can call `pay({ type, referenceId, sellerId, amountSol })` directly.
 */
export function useSolanaPayment() {
    const solana = useEmbeddedSolanaWallet();
    const wallet = solana.wallets?.[0];

    const pay = useCallback(
        async (args: {
            type: OrderType;
            referenceId: string;
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

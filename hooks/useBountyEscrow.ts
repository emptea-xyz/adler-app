import { useCallback, useState } from 'react';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { createBounty as escrowCreateBounty } from '@/lib/escrow/createBounty';
import { settleManualBounty as escrowSettleManual } from '@/lib/escrow/settleManualBounty';
import { refundBounty as escrowRefund } from '@/lib/escrow/refundBounty';
import {
    draftBounty,
    persistBounty,
    markManualSettled,
} from '@/lib/services/bountyService';
import type { Bounty, BountyMode } from '@/lib/types/bounty';

export interface PostBountyInput {
    title: string;
    prompt: string;
    mode: BountyMode;
    bountyLamports: number;
    scope: 'public' | 'group';
    groupId?: string | null;
}

interface UseBountyEscrowReturn {
    pending: boolean;
    error: string | null;
    post: (input: PostBountyInput) => Promise<Bounty>;
    settleManual: (input: {
        bountyId: string;
        bountyIdHex: string;
        posterWalletAddress: string;
        winnerId: string;
        winningSubmissionId: string;
        winnerWalletAddress: string;
    }) => Promise<string>;
    refund: (input: {
        bountyIdHex: string;
        posterWalletAddress: string;
        callerWalletAddress: string;
    }) => Promise<string>;
}

export function useBountyEscrow(): UseBountyEscrowReturn {
    const wallet = useEmbeddedSolanaWallet();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const provider = useCallback(async () => {
        if (!wallet?.wallets || wallet.wallets.length === 0) {
            throw new Error('Embedded wallet is not ready yet.');
        }
        return wallet.getProvider();
    }, [wallet]);

    const posterWalletAddress = wallet?.wallets?.[0]?.address ?? null;

    const post = useCallback(
        async (input: PostBountyInput): Promise<Bounty> => {
            if (!posterWalletAddress) throw new Error('Wallet not ready');
            setPending(true);
            setError(null);
            try {
                const draft = await draftBounty();
                const p = await provider();
                await escrowCreateBounty({
                    bountyIdHex: draft.contractIdHex,
                    posterWalletAddress,
                    amountLamports: input.bountyLamports,
                    mode: input.mode,
                    provider: p,
                });
                const bounty = await persistBounty({
                    docId: draft.docId,
                    contractIdHex: draft.contractIdHex,
                    expiresAt: draft.expiresAt,
                    title: input.title,
                    prompt: input.prompt,
                    mode: input.mode,
                    bountyLamports: input.bountyLamports,
                    posterWalletAddress,
                    scope: input.scope,
                    groupId: input.groupId ?? null,
                });
                return bounty;
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg);
                throw e;
            } finally {
                setPending(false);
            }
        },
        [posterWalletAddress, provider],
    );

    const settleManual = useCallback(
        async (input: {
            bountyId: string;
            bountyIdHex: string;
            posterWalletAddress: string;
            winnerId: string;
            winningSubmissionId: string;
            winnerWalletAddress: string;
        }): Promise<string> => {
            setPending(true);
            setError(null);
            try {
                const p = await provider();
                const sig = await escrowSettleManual({
                    bountyIdHex: input.bountyIdHex,
                    posterWalletAddress: input.posterWalletAddress,
                    winnerWalletAddress: input.winnerWalletAddress,
                    provider: p,
                });
                await markManualSettled(
                    input.bountyId,
                    input.winnerId,
                    input.winningSubmissionId,
                    sig,
                );
                return sig;
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg);
                throw e;
            } finally {
                setPending(false);
            }
        },
        [provider],
    );

    const refund = useCallback(
        async (input: {
            bountyIdHex: string;
            posterWalletAddress: string;
            callerWalletAddress: string;
        }): Promise<string> => {
            setPending(true);
            setError(null);
            try {
                const p = await provider();
                return await escrowRefund({
                    bountyIdHex: input.bountyIdHex,
                    posterWalletAddress: input.posterWalletAddress,
                    callerWalletAddress: input.callerWalletAddress,
                    provider: p,
                });
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg);
                throw e;
            } finally {
                setPending(false);
            }
        },
        [provider],
    );

    return { pending, error, post, settleManual, refund };
}

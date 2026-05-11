import { useCallback, useState } from 'react';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { createBounty as escrowCreateBounty } from '@/lib/escrow/createBounty';
import { settleManualBounty as escrowSettleManual } from '@/lib/escrow/settleManualBounty';
import { refundBounty as escrowRefund } from '@/lib/escrow/refundBounty';
import { cancelBounty as escrowCancel } from '@/lib/escrow/cancelBounty';
import {
    draftBounty,
    persistBounty,
    markManualSettled,
    startCancel,
    finishCancel,
    abortCancel,
} from '@/lib/services/bountyService';
import type {
    Bounty,
    BountyStatus,
    BountySubmissionKind,
} from '@/lib/types/bounty';

export interface PostBountyInput {
    title: string;
    prompt: string;
    bountyLamports: number;
    scope: 'public' | 'group';
    groupId?: string | null;
    submissionKind: BountySubmissionKind;
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
    cancel: (input: {
        bountyId: string;
        bountyIdHex: string;
        posterWalletAddress: string;
    }) => Promise<string>;
}

export function useBountyEscrow(): UseBountyEscrowReturn {
    const wallet = useEmbeddedSolanaWallet();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const provider = useCallback(async () => {
        if (!wallet?.wallets || wallet.wallets.length === 0 || !wallet.getProvider) {
            throw new Error('Embedded wallet is not ready yet.');
        }
        return wallet.getProvider();
    }, [wallet]);

    const posterWalletAddress = wallet?.wallets?.[0]?.address ?? null;

    const runMutation = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
        setPending(true);
        setError(null);
        try {
            return await fn();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            throw e;
        } finally {
            setPending(false);
        }
    }, []);

    const post = useCallback(
        (input: PostBountyInput) => runMutation(async () => {
            if (!posterWalletAddress) throw new Error('Wallet not ready');
            const draft = await draftBounty();
            const p = await provider();
            await escrowCreateBounty({
                bountyIdHex: draft.contractIdHex,
                posterWalletAddress,
                amountLamports: input.bountyLamports,
                provider: p,
            });
            return persistBounty({
                docId: draft.docId,
                contractIdHex: draft.contractIdHex,
                submissionEndsAt: draft.submissionEndsAt,
                expiresAt: draft.expiresAt,
                title: input.title,
                prompt: input.prompt,
                bountyLamports: input.bountyLamports,
                posterWalletAddress,
                scope: input.scope,
                groupId: input.groupId ?? null,
                submissionKind: input.submissionKind,
            });
        }),
        [posterWalletAddress, provider, runMutation],
    );

    const settleManual = useCallback(
        (input: {
            bountyId: string;
            bountyIdHex: string;
            posterWalletAddress: string;
            winnerId: string;
            winningSubmissionId: string;
            winnerWalletAddress: string;
        }) => runMutation(async () => {
            const p = await provider();
            const sig = await escrowSettleManual({
                bountyIdHex: input.bountyIdHex,
                posterWalletAddress: input.posterWalletAddress,
                winnerWalletAddress: input.winnerWalletAddress,
                provider: p,
            });
            await markManualSettled(input.bountyId, input.winnerId, input.winningSubmissionId, sig);
            return sig;
        }),
        [provider, runMutation],
    );

    const refund = useCallback(
        (input: {
            bountyIdHex: string;
            posterWalletAddress: string;
            callerWalletAddress: string;
        }) => runMutation(async () => {
            const p = await provider();
            return escrowRefund({
                bountyIdHex: input.bountyIdHex,
                posterWalletAddress: input.posterWalletAddress,
                callerWalletAddress: input.callerWalletAddress,
                provider: p,
            });
        }),
        [provider, runMutation],
    );

    const cancel = useCallback(
        (input: {
            bountyId: string;
            bountyIdHex: string;
            posterWalletAddress: string;
        }) => runMutation(async () => {
            let cancelledFrom: BountyStatus | null = null;
            try {
                const { from } = await startCancel(input.bountyId);
                cancelledFrom = from;
                const p = await provider();
                const sig = await escrowCancel({
                    bountyIdHex: input.bountyIdHex,
                    posterWalletAddress: input.posterWalletAddress,
                    provider: p,
                });
                await finishCancel(input.bountyId, sig);
                return sig;
            } catch (e) {
                if (cancelledFrom) {
                    // The bounty is now stuck in `cancelling` for the
                    // poster. The next sweep of `expireBounties` will
                    // observe `cancelling` past expiresAt and reconcile
                    // via on-chain refund. Logged but not surfaced — we
                    // don't want to mask the original error.
                    abortCancel(input.bountyId, cancelledFrom).catch((err) =>
                        console.warn('abortCancel failed', err),
                    );
                }
                throw e;
            }
        }),
        [provider, runMutation],
    );

    return { pending, error, post, settleManual, refund, cancel };
}

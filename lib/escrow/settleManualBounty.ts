import { PublicKey } from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { buildEscrowCtx, baseAccounts } from '@/lib/escrow/_build';
import { fetchFeeTreasury } from '@/lib/anchor/useFeeTreasury';
import { sendIxs } from '@/lib/escrow/_send';

export interface SettleManualBountyInput {
    bountyIdHex: string;
    posterWalletAddress: string;
    winnerWalletAddress: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
}

export async function settleManualBounty(input: SettleManualBountyInput): Promise<string> {
    const ctx = buildEscrowCtx(input.bountyIdHex, input.posterWalletAddress);
    const winnerPubkey = new PublicKey(input.winnerWalletAddress);
    const feeTreasury = await fetchFeeTreasury();

    const ix = await ctx.program.methods
        .settleManualBounty(ctx.bountyIdArray)
        .accountsPartial({ ...baseAccounts(ctx), winner: winnerPubkey, feeTreasury })
        .instruction();

    return sendIxs(input.provider, [ix], ctx.posterPubkey);
}

import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { buildEscrowCtx, baseAccounts } from '@/lib/escrow/_build';
import { fetchFeeTreasury } from '@/lib/anchor/useFeeTreasury';
import { sendIxs } from '@/lib/escrow/_send';

interface EscrowInputBase {
    bountyIdHex: string;
    posterWalletAddress: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
}

export interface CreateBountyInput extends EscrowInputBase {
    amountLamports: number;
}

export async function createBounty(input: CreateBountyInput): Promise<string> {
    const ctx = buildEscrowCtx(input.bountyIdHex, input.posterWalletAddress);
    const ix = await ctx.program.methods
        .createBounty(ctx.bountyIdArray, new BN(input.amountLamports))
        .accountsPartial(baseAccounts(ctx))
        .instruction();
    return sendIxs(input.provider, [ix], ctx.posterPubkey);
}

export interface SettleManualBountyInput extends EscrowInputBase {
    winnerWalletAddress: string;
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

export interface RefundBountyInput extends EscrowInputBase {
    callerWalletAddress: string;
}

export async function refundBounty(input: RefundBountyInput): Promise<string> {
    const ctx = buildEscrowCtx(input.bountyIdHex, input.posterWalletAddress);
    const callerPubkey = new PublicKey(input.callerWalletAddress);
    const ix = await ctx.program.methods
        .refundBounty(ctx.bountyIdArray)
        .accountsPartial({ ...baseAccounts(ctx), caller: callerPubkey })
        .instruction();
    return sendIxs(input.provider, [ix], callerPubkey);
}

export type CancelBountyInput = EscrowInputBase;

export async function cancelBounty(input: CancelBountyInput): Promise<string> {
    const ctx = buildEscrowCtx(input.bountyIdHex, input.posterWalletAddress);
    const ix = await ctx.program.methods
        .cancelBounty(ctx.bountyIdArray)
        .accountsPartial(baseAccounts(ctx))
        .instruction();
    return sendIxs(input.provider, [ix], ctx.posterPubkey);
}

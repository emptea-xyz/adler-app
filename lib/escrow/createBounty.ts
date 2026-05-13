import { BN } from '@coral-xyz/anchor';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { buildEscrowCtx, baseAccounts } from '@/lib/escrow/_build';
import { sendIxs } from '@/lib/escrow/_send';

export interface CreateBountyInput {
    bountyIdHex: string;
    posterWalletAddress: string;
    amountLamports: number;
    provider: PrivyEmbeddedSolanaWalletProvider;
}

export async function createBounty(input: CreateBountyInput): Promise<string> {
    const ctx = buildEscrowCtx(input.bountyIdHex, input.posterWalletAddress);

    const ix = await ctx.program.methods
        .createBounty(ctx.bountyIdArray, new BN(input.amountLamports))
        .accountsPartial(baseAccounts(ctx))
        .instruction();

    return sendIxs(input.provider, [ix], ctx.posterPubkey);
}

import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { buildEscrowCtx, baseAccounts } from '@/lib/escrow/_build';
import { sendIxs } from '@/lib/escrow/_send';

export interface CancelBountyInput {
    bountyIdHex: string;
    posterWalletAddress: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
}

export async function cancelBounty(input: CancelBountyInput): Promise<string> {
    const ctx = buildEscrowCtx(input.bountyIdHex, input.posterWalletAddress);

    const ix = await ctx.program.methods
        .cancelBounty(ctx.bountyIdArray)
        .accountsPartial(baseAccounts(ctx))
        .instruction();

    return sendIxs(input.provider, [ix], ctx.posterPubkey);
}

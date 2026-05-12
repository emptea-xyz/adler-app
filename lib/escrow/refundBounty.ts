import { PublicKey } from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { buildEscrowCtx, baseAccounts } from '@/lib/escrow/_build';
import { sendIxs } from '@/lib/escrow/_send';

export interface RefundBountyInput {
    bountyIdHex: string;
    posterWalletAddress: string;
    callerWalletAddress: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
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

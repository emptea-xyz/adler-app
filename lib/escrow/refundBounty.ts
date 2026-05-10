import { PublicKey, SystemProgram } from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { getProgram } from '@/lib/anchor/program';
import { contractIdFromHex, deriveBountyEscrowPda, deriveProtocolConfigPda } from '@/lib/escrow/pda';
import { sendIxs } from '@/lib/escrow/_send';

export interface RefundBountyInput {
    bountyIdHex: string;
    posterWalletAddress: string;
    callerWalletAddress: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
}

export async function refundBounty(input: RefundBountyInput): Promise<string> {
    const program = getProgram();
    const posterPubkey = new PublicKey(input.posterWalletAddress);
    const callerPubkey = new PublicKey(input.callerWalletAddress);
    const bountyIdBytes = contractIdFromHex(input.bountyIdHex);
    const escrowPda = deriveBountyEscrowPda(input.posterWalletAddress, bountyIdBytes);
    const configPda = deriveProtocolConfigPda();

    const ix = await program.methods
        .refundBounty(Array.from(bountyIdBytes))
        .accountsPartial({
            config: configPda,
            escrow: escrowPda,
            poster: posterPubkey,
            caller: callerPubkey,
            systemProgram: SystemProgram.programId,
        })
        .instruction();

    return sendIxs(input.provider, [ix]);
}

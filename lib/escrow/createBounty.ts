import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { getProgram } from '@/lib/anchor/program';
import { contractIdFromHex, deriveBountyEscrowPda, deriveProtocolConfigPda } from '@/lib/escrow/pda';
import { sendIxs } from '@/lib/escrow/_send';
import { BountyMode } from '@/lib/constants/escrow';

export interface CreateBountyInput {
    bountyIdHex: string;
    posterWalletAddress: string;
    amountLamports: number;
    mode: 'manual' | 'auto';
    provider: PrivyEmbeddedSolanaWalletProvider;
}

export async function createBounty(input: CreateBountyInput): Promise<string> {
    const program = getProgram();
    const posterPubkey = new PublicKey(input.posterWalletAddress);
    const bountyIdBytes = contractIdFromHex(input.bountyIdHex);
    const escrowPda = deriveBountyEscrowPda(input.posterWalletAddress, bountyIdBytes);
    const configPda = deriveProtocolConfigPda();
    const modeByte = input.mode === 'manual' ? BountyMode.Manual : BountyMode.Auto;

    const ix = await program.methods
        .createBounty(Array.from(bountyIdBytes), new BN(input.amountLamports), modeByte)
        .accounts({
            config: configPda,
            escrow: escrowPda,
            poster: posterPubkey,
            systemProgram: SystemProgram.programId,
        })
        .instruction();

    return sendIxs(input.provider, [ix]);
}

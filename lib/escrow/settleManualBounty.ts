import { PublicKey, SystemProgram } from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { getProgram } from '@/lib/anchor/program';
import { contractIdFromHex, deriveBountyEscrowPda, deriveProtocolConfigPda } from '@/lib/escrow/pda';
import { fetchFeeTreasury } from '@/lib/anchor/useFeeTreasury';
import { sendIxs } from '@/lib/escrow/_send';

export interface SettleManualBountyInput {
    bountyIdHex: string;
    posterWalletAddress: string;
    winnerWalletAddress: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
}

export async function settleManualBounty(input: SettleManualBountyInput): Promise<string> {
    const program = getProgram();
    const posterPubkey = new PublicKey(input.posterWalletAddress);
    const winnerPubkey = new PublicKey(input.winnerWalletAddress);
    const bountyIdBytes = contractIdFromHex(input.bountyIdHex);
    const escrowPda = deriveBountyEscrowPda(input.posterWalletAddress, bountyIdBytes);
    const configPda = deriveProtocolConfigPda();
    const feeTreasury = await fetchFeeTreasury();

    const ix = await program.methods
        .settleManualBounty(Array.from(bountyIdBytes))
        .accountsPartial({
            config: configPda,
            escrow: escrowPda,
            poster: posterPubkey,
            winner: winnerPubkey,
            feeTreasury,
            systemProgram: SystemProgram.programId,
        })
        .instruction();

    return sendIxs(input.provider, [ix]);
}

import { BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { V1_PROGRAM_ID } from '@/lib/constants/escrow';
import { solToLamports } from '@/lib/solana/connection';
import { getProgram } from '@/lib/anchor/program';
import {
    deriveContractEscrowPda,
    deriveContractId,
    deriveProtocolConfigPda,
} from '@/lib/escrow/pda';
import { sendIxs } from '@/lib/escrow/_send';

export interface FundGigInput {
    gigId: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
    brandWalletAddress: string;
    budgetSol: number;
    deliveryDeadline: number;
}

export async function fundGig(input: FundGigInput): Promise<{
    signature: string;
    contractId32: string;
    escrowPda: string;
}> {
    const program = getProgram();
    const contractId = await deriveContractId(input.gigId);
    const brandPk = new PublicKey(input.brandWalletAddress);
    const configPda = deriveProtocolConfigPda(V1_PROGRAM_ID);
    const escrowPda = deriveContractEscrowPda(input.brandWalletAddress, contractId.bytes);

    const ix = await program.methods
        .fundGig(
            Array.from(contractId.bytes),
            new BN(solToLamports(input.budgetSol)),
            new BN(input.deliveryDeadline),
        )
        .accountsStrict({
            config: configPda,
            escrow: escrowPda,
            brand: brandPk,
            systemProgram: SystemProgram.programId,
        })
        .instruction();

    const signature = await sendIxs(input.provider, [ix]);
    return {
        signature,
        contractId32: contractId.hex,
        escrowPda: escrowPda.toBase58(),
    };
}

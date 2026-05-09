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

export interface FundServiceInput {
    orderId: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
    fromAddress: string;
    creatorPubkey: string;
    amountSol: number;
}

export async function fundService(input: FundServiceInput): Promise<{ signature: string; escrowPda: string }> {
    const program = getProgram();
    const contractId = await deriveContractId(input.orderId);
    const brandPk = new PublicKey(input.fromAddress);
    const creatorPk = new PublicKey(input.creatorPubkey);
    const configPda = deriveProtocolConfigPda(V1_PROGRAM_ID);
    const escrowPda = deriveContractEscrowPda(input.fromAddress, contractId.bytes);

    const ix = await program.methods
        .fundService(Array.from(contractId.bytes), new BN(solToLamports(input.amountSol)))
        .accountsStrict({
            config: configPda,
            escrow: escrowPda,
            brand: brandPk,
            creator: creatorPk,
            systemProgram: SystemProgram.programId,
        })
        .instruction();

    const signature = await sendIxs(input.provider, [ix]);
    return { signature, escrowPda: escrowPda.toBase58() };
}

import { PublicKey } from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { V1_PROGRAM_ID } from '@/lib/constants/escrow';
import { getProgram } from '@/lib/anchor/program';
import {
    contractIdFromHex,
    deriveContractEscrowPda,
    deriveProtocolConfigPda,
} from '@/lib/escrow/pda';
import { sendIxs } from '@/lib/escrow/_send';

export interface BindCreatorInput {
    contractIdHex: string;
    brandWalletAddress: string;
    creatorWalletAddress: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
}

export async function bindCreator(input: BindCreatorInput): Promise<{ signature: string }> {
    const program = getProgram();
    const contractId = contractIdFromHex(input.contractIdHex);
    const brandPk = new PublicKey(input.brandWalletAddress);
    const creatorPk = new PublicKey(input.creatorWalletAddress);
    const configPda = deriveProtocolConfigPda(V1_PROGRAM_ID);
    const escrowPda = deriveContractEscrowPda(input.brandWalletAddress, contractId);

    const ix = await program.methods
        .bindCreator(Array.from(contractId))
        .accountsStrict({
            config: configPda,
            escrow: escrowPda,
            brand: brandPk,
            creator: creatorPk,
        })
        .instruction();

    return { signature: await sendIxs(input.provider, [ix]) };
}

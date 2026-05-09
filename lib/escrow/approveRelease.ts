import { PublicKey, SystemProgram } from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { V1_PROGRAM_ID } from '@/lib/constants/escrow';
import { fetchFeeTreasury } from '@/lib/anchor/useFeeTreasury';
import { getProgram } from '@/lib/anchor/program';
import { getConnection } from '@/lib/solana/connection';
import {
    contractIdFromHex,
    deriveContractEscrowPda,
    deriveContractRecordPda,
    deriveProtocolConfigPda,
} from '@/lib/escrow/pda';
import { sendIxs, type EscrowError } from '@/lib/escrow/_send';

export interface ApproveReleaseInput {
    contractIdHex: string;
    brandWalletAddress: string;
    creatorPubkey: string;
    provider: PrivyEmbeddedSolanaWalletProvider;
}

export async function approveRelease(input: ApproveReleaseInput): Promise<{ signature: string | null }> {
    const program = getProgram();
    const contractId = contractIdFromHex(input.contractIdHex);
    const brandPk = new PublicKey(input.brandWalletAddress);
    const creatorPk = new PublicKey(input.creatorPubkey);
    const configPda = deriveProtocolConfigPda(V1_PROGRAM_ID);
    const escrowPda = deriveContractEscrowPda(input.brandWalletAddress, contractId);
    const recordPda = deriveContractRecordPda(input.brandWalletAddress, contractId);

    const existing = await getConnection().getAccountInfo(escrowPda);
    if (!existing) return { signature: null };

    let feeTreasury = await fetchFeeTreasury();

    const buildAndSend = async (): Promise<string> => {
        const ix = await program.methods
            .approveRelease(Array.from(contractId))
            .accountsStrict({
                config: configPda,
                escrow: escrowPda,
                record: recordPda,
                brand: brandPk,
                creator: creatorPk,
                feeTreasury,
                systemProgram: SystemProgram.programId,
            })
            .instruction();
        return sendIxs(input.provider, [ix]);
    };

    try {
        return { signature: await buildAndSend() };
    } catch (err) {
        const escrowErr = err as EscrowError;
        if (escrowErr.code === 'FeeTreasuryMismatch') {
            feeTreasury = await fetchFeeTreasury();
            return { signature: await buildAndSend() };
        }
        throw err;
    }
}

import { PublicKey } from '@solana/web3.js';
import { V1_PROGRAM_ID } from '@/lib/constants/escrow';
import { deriveProtocolConfigPda } from '@/lib/escrow/pda';
import { getProgram } from '@/lib/anchor/program';

export async function fetchFeeTreasury(): Promise<PublicKey> {
    const program = getProgram();
    const configPda = deriveProtocolConfigPda(V1_PROGRAM_ID);
    const cfg = await program.account.protocolConfig.fetch(configPda);
    return cfg.feeTreasury;
}

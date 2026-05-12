import { PublicKey } from '@solana/web3.js';
import { deriveProtocolConfigPda } from '@/lib/escrow/pda';
import { getProgram } from '@/lib/anchor/program';

export async function fetchFeeTreasury(): Promise<PublicKey> {
    const program = getProgram();
    const configPda = deriveProtocolConfigPda();
    const cfg = await program.account.protocolConfig.fetch(configPda);
    return cfg.feeTreasury;
}

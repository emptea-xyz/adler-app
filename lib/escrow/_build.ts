import { PublicKey, SystemProgram } from '@solana/web3.js';
import type { Program } from '@coral-xyz/anchor';
import { getProgram } from '@/lib/anchor/program';
import type { AdlerEscrow } from '@/lib/anchor/idl-types';
import { contractIdFromHex, deriveBountyEscrowPda, deriveProtocolConfigPda } from '@/lib/escrow/pda';

export interface EscrowCtx {
    program: Program<AdlerEscrow>;
    posterPubkey: PublicKey;
    bountyIdArray: number[];
    escrowPda: PublicKey;
    configPda: PublicKey;
}

export function buildEscrowCtx(bountyIdHex: string, posterWalletAddress: string): EscrowCtx {
    const program = getProgram();
    const posterPubkey = new PublicKey(posterWalletAddress);
    const bountyIdBytes = contractIdFromHex(bountyIdHex);
    return {
        program,
        posterPubkey,
        bountyIdArray: Array.from(bountyIdBytes),
        escrowPda: deriveBountyEscrowPda(posterWalletAddress, bountyIdBytes),
        configPda: deriveProtocolConfigPda(),
    };
}

/** Accounts shared by every bounty instruction: config, escrow, poster, systemProgram. */
export function baseAccounts(ctx: EscrowCtx) {
    return {
        config: ctx.configPda,
        escrow: ctx.escrowPda,
        poster: ctx.posterPubkey,
        systemProgram: SystemProgram.programId,
    };
}

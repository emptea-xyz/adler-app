import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import idl from '@/lib/anchor/idl';
import type { AdlerEscrow } from '@/lib/anchor/idl-types';
import { getConnection } from '@/lib/solana/connection';

const dummyKeypair = Keypair.generate();
const refuseSign = () => Promise.reject(new Error('Adler escrow signs via Privy, not AnchorProvider'));
const dummyWallet = {
    publicKey: dummyKeypair.publicKey,
    signTransaction: refuseSign as never,
    signAllTransactions: refuseSign as never,
    payer: dummyKeypair,
};

let cached: Program<AdlerEscrow> | null = null;

export function getProgram(): Program<AdlerEscrow> {
    if (cached) return cached;
    const provider = new AnchorProvider(getConnection(), dummyWallet, {
        commitment: 'confirmed',
    });
    cached = new Program(idl as Idl, provider) as unknown as Program<AdlerEscrow>;
    return cached;
}

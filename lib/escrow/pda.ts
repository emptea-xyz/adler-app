import * as Crypto from 'expo-crypto';
import { PublicKey } from '@solana/web3.js';
import { V1_PROGRAM_ID } from '@/lib/constants/escrow';

export interface ContractId {
    bytes: Uint8Array;
    hex: string;
}

function hexToBytes(hex: string): Uint8Array {
    const pairs = hex.match(/.{1,2}/g) ?? [];
    return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

export async function deriveContractId(orderId: string): Promise<ContractId> {
    const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, orderId);
    return { hex, bytes: hexToBytes(hex) };
}

export function deriveContractEscrowPda(
    buyerWalletAddress: string,
    contractId: Uint8Array,
): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow'), new PublicKey(buyerWalletAddress).toBuffer(), Buffer.from(contractId)],
        V1_PROGRAM_ID,
    );
    return pda;
}

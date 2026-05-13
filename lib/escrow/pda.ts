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

/**
 * Deterministic 32-byte derivation of the on-chain bounty id from the
 * off-chain Firestore doc id. SHA-256(bountyId). The on-chain side stores
 * the same 32 bytes as the PDA seed (`[b"bounty", poster, bounty_id]`).
 */
export async function deriveBountyId(off_chain_id: string): Promise<ContractId> {
    const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, off_chain_id);
    return { hex, bytes: hexToBytes(hex) };
}

export function contractIdFromHex(hex: string): Uint8Array {
    return hexToBytes(hex);
}

export function deriveBountyEscrowPda(
    posterWalletAddress: string,
    bountyIdBytes: Uint8Array,
): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bounty_v2'), new PublicKey(posterWalletAddress).toBuffer(), Buffer.from(bountyIdBytes)],
        V1_PROGRAM_ID,
    );
    return pda;
}

export function deriveProtocolConfigPda(): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('bounty_config_v2')], V1_PROGRAM_ID)[0];
}

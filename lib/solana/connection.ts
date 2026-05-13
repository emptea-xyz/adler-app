import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SOLANA_RPC_URL, SOLANA_EXPLORER_BASE, SOLANA_NETWORK } from '@/lib/constants/featureGates';

let connection: Connection | null = null;

export function getConnection(): Connection {
    if (!connection) {
        connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    }
    return connection;
}

export function solToLamports(sol: number): number {
    return Math.round(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
    return lamports / LAMPORTS_PER_SOL;
}

export function explorerTxUrl(signature: string): string {
    return `${SOLANA_EXPLORER_BASE}/tx/${signature}?cluster=${SOLANA_NETWORK}`;
}

export function explorerAddressUrl(address: string): string {
    return `${SOLANA_EXPLORER_BASE}/address/${address}?cluster=${SOLANA_NETWORK}`;
}

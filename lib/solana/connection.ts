import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SOLANA_RPC_URL, SOLANA_EXPLORER_BASE, SOLANA_NETWORK } from '@/lib/constants/featureGates';
import { getAppCheckTokenString } from '@/lib/firebase/config';

let connection: Connection | null = null;

// Our Cloud Function / Cloud Run proxies require an App Check token; Helius
// direct URLs do not. Detect the proxy by hostname.
function isProxyUrl(url: string): boolean {
    return (
        url.includes('cloudfunctions.net') ||
        url.includes('run.app') ||
        url.includes('solanaRpcProxy')
    );
}

const proxyFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers ?? {});
    const token = await getAppCheckTokenString();
    if (token) headers.set('X-Firebase-AppCheck', token);
    return fetch(input, { ...init, headers });
};

export function getConnection(): Connection {
    if (!connection) {
        const opts = isProxyUrl(SOLANA_RPC_URL)
            ? { commitment: 'confirmed' as const, fetch: proxyFetch }
            : 'confirmed';
        connection = new Connection(SOLANA_RPC_URL, opts);
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

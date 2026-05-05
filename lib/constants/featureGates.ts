/** Use mock data in development. Set to false to use real Firebase in dev. */
export const USE_DEV_DATA = false;

/**
 * Solana network + RPC. Driven by env so the same JS bundle ships to both
 * devnet (preview) and mainnet (production) builds via separate EAS profiles.
 *
 * - EXPO_PUBLIC_SOLANA_NETWORK: 'devnet' | 'mainnet-beta' | 'testnet'.
 *   Defaults to 'devnet' so local dev "just works" without a .env entry.
 * - EXPO_PUBLIC_SOLANA_RPC_PROXY_URL: a Cloud Function URL (the
 *   `solanaRpcProxy` we deploy). Preferred for production since it keeps the
 *   paid Helius API key server-side. When set, `SOLANA_RPC_URL` resolves to
 *   it, ignoring the direct-Helius var below.
 * - EXPO_PUBLIC_SOLANA_RPC_URL: full RPC endpoint. Used in dev/preview
 *   directly against Helius (where shipping the key is acceptable). Public
 *   RPCs are rate-limited and unsuitable for production.
 */
export type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet';

const ALLOWED_NETWORKS: readonly SolanaNetwork[] = ['devnet', 'mainnet-beta', 'testnet'];
const RAW_NETWORK = (process.env.EXPO_PUBLIC_SOLANA_NETWORK ?? 'devnet').toLowerCase();
function resolveNetwork(): SolanaNetwork {
    return (ALLOWED_NETWORKS as readonly string[]).includes(RAW_NETWORK)
        ? (RAW_NETWORK as SolanaNetwork)
        : 'devnet';
}

const DEFAULT_RPC_BY_NETWORK: Record<SolanaNetwork, string> = {
    'devnet': 'https://api.devnet.solana.com',
    'mainnet-beta': 'https://api.mainnet-beta.solana.com',
    'testnet': 'https://api.testnet.solana.com',
};

export const SOLANA_NETWORK: SolanaNetwork = resolveNetwork();
export const SOLANA_RPC_URL: string =
    // 1. Server-side proxy (production-safe — no API key in the bundle).
    process.env.EXPO_PUBLIC_SOLANA_RPC_PROXY_URL ??
    // 2. Direct RPC URL (dev/preview where the Helius key is fine to ship).
    process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
    // 3. Public Solana RPC (rate-limited; defensive default).
    DEFAULT_RPC_BY_NETWORK[SOLANA_NETWORK];
export const SOLANA_EXPLORER_BASE = 'https://explorer.solana.com';

/**
 * Solana network + RPC.
 *
 * - EXPO_PUBLIC_SOLANA_NETWORK: 'devnet' | 'mainnet-beta' | 'testnet'.
 *   Defaults to 'devnet' so local dev "just works" without a .env entry.
 * - EXPO_PUBLIC_SOLANA_RPC_URL: optional override.
 *   - In dev: required (point at Helius directly — App Check tokens
 *     aren't available, so the proxy would 401).
 *   - In prod/TestFlight: optional. Defaults to the Cloud Function proxy
 *     for the selected network (App Check enforced, Helius key hidden).
 *
 * Public RPCs (api.devnet.solana.com etc.) are never used — rate-limited
 * and unreliable. If no URL is configured in dev, we throw immediately.
 */
export type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet';

const ALLOWED_NETWORKS: readonly SolanaNetwork[] = ['devnet', 'mainnet-beta', 'testnet'];
const RAW_NETWORK = (process.env.EXPO_PUBLIC_SOLANA_NETWORK ?? 'devnet').toLowerCase();

export const SOLANA_NETWORK: SolanaNetwork = (ALLOWED_NETWORKS as readonly string[]).includes(
    RAW_NETWORK,
)
    ? (RAW_NETWORK as SolanaNetwork)
    : 'devnet';

const PROXY_RPC_BY_NETWORK: Record<SolanaNetwork, string> = {
    'devnet': 'https://us-central1-emptea-adler.cloudfunctions.net/solanaRpcProxyDevnet',
    'mainnet-beta': 'https://us-central1-emptea-adler.cloudfunctions.net/solanaRpcProxyMainnet',
    'testnet': 'https://us-central1-emptea-adler.cloudfunctions.net/solanaRpcProxyTestnet',
};

function resolveRpcUrl(): string {
    const explicit = process.env.EXPO_PUBLIC_SOLANA_RPC_URL;
    if (explicit) return explicit;
    if (!__DEV__) return PROXY_RPC_BY_NETWORK[SOLANA_NETWORK];
    throw new Error(
        `EXPO_PUBLIC_SOLANA_RPC_URL is required in dev. Set it to a Helius ${SOLANA_NETWORK} URL in .env.`,
    );
}

export const SOLANA_RPC_URL: string = resolveRpcUrl();
export const SOLANA_EXPLORER_BASE = 'https://explorer.solana.com';

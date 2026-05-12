/**
 * Solana network + RPC. Driven by env so the same JS bundle ships to both
 * devnet (preview) and mainnet (production) builds via separate EAS profiles.
 *
 * - EXPO_PUBLIC_SOLANA_NETWORK: 'devnet' | 'mainnet-beta' | 'testnet'.
 *   Defaults to 'devnet' so local dev "just works" without a .env entry.
 * - EXPO_PUBLIC_SOLANA_RPC_PROXY_URL: a Cloud Function URL (the
 *   `solanaRpcProxy` we deploy). Preferred for production since it keeps
 *   the paid Helius API key server-side. When set, `SOLANA_RPC_URL`
 *   resolves to it, ignoring the direct-Helius var below.
 * - EXPO_PUBLIC_SOLANA_RPC_URL: full RPC endpoint. Used in dev/preview
 *   directly against Helius (where shipping the key is acceptable).
 *   Public RPCs are rate-limited and unsuitable for production.
 */
export type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet';

const ALLOWED_NETWORKS: readonly SolanaNetwork[] = ['devnet', 'mainnet-beta', 'testnet'];
const RAW_NETWORK = (process.env.EXPO_PUBLIC_SOLANA_NETWORK ?? 'devnet').toLowerCase();
function resolveNetwork(): SolanaNetwork {
    return (ALLOWED_NETWORKS as readonly string[]).includes(RAW_NETWORK)
        ? (RAW_NETWORK as SolanaNetwork)
        : 'devnet';
}

// In production the client routes through our Cloud Function proxy so the
// paid Helius key stays server-side AND the App Check enforcement layer on
// the proxy can reject bot/spoofed calls. In __DEV__ that proxy returns
// 401 (App Check is skipped in dev per lib/firebase/config.ts), so dev
// builds must point EXPO_PUBLIC_SOLANA_RPC_URL at Helius directly.
//
// Hard rule (user directive): never fall back to public Solana RPCs
// (api.devnet.solana.com etc.) — they're rate-limited and unreliable.
// If no Helius URL is configured in dev, we throw immediately so the
// developer notices instead of silently bleeding into a broken state.
const PROXY_RPC_BY_NETWORK: Record<SolanaNetwork, string> = {
    'devnet': 'https://us-central1-emptea-adler.cloudfunctions.net/solanaRpcProxyDevnet',
    'mainnet-beta': 'https://us-central1-emptea-adler.cloudfunctions.net/solanaRpcProxyMainnet',
    'testnet': 'https://us-central1-emptea-adler.cloudfunctions.net/solanaRpcProxyTestnet',
};

export const SOLANA_NETWORK: SolanaNetwork = resolveNetwork();

function resolveRpcUrl(): string {
    // 1. Explicit override (Helius URL in dev; proxy URL or custom in prod).
    const explicit =
        process.env.EXPO_PUBLIC_SOLANA_RPC_PROXY_URL ??
        process.env.EXPO_PUBLIC_SOLANA_RPC_URL;
    if (explicit) return explicit;
    // 2. Prod default: server-side proxy (App Check enforced, key hidden).
    if (!__DEV__) return PROXY_RPC_BY_NETWORK[SOLANA_NETWORK];
    // 3. Dev with no URL → loud failure (better than silent rate-limit).
    throw new Error(
        'EXPO_PUBLIC_SOLANA_RPC_URL is required in dev. Set it to a Helius ' +
            `devnet URL in .env (see HELIUS_RPC_URL_${SOLANA_NETWORK === 'mainnet-beta' ? 'MAINNET' : SOLANA_NETWORK.toUpperCase()} ` +
            'secret in Firebase functions config).',
    );
}

export const SOLANA_RPC_URL: string = resolveRpcUrl();
export const SOLANA_EXPLORER_BASE = 'https://explorer.solana.com';

/**
 * Wallet Standard chain id. The Privy embedded wallet expects this on every
 * `signAndSendTransaction({ chain })` call. Mapping mirrors web's
 * featureGates: only mainnet/testnet get their own; everything else
 * (including the lonely 'devnet') resolves to `solana:devnet`.
 */
export const SOLANA_CHAIN_ID: `solana:${'mainnet' | 'devnet' | 'testnet'}` =
    SOLANA_NETWORK === 'mainnet-beta'
        ? 'solana:mainnet'
        : SOLANA_NETWORK === 'testnet'
            ? 'solana:testnet'
            : 'solana:devnet';

export const IS_DEVNET_LIKE: boolean = SOLANA_NETWORK !== 'mainnet-beta';

/**
 * Protocol fee charged at settlement: 0.50% of the contract amount, in
 * basis points. Mirrors `ProtocolConfig.fee_bps_default` on-chain — the
 * actual fee withheld is whatever the program writes to
 * `escrow.fee_lamports` at fund time, but the client estimates with this
 * for receipts and billing aggregates.
 */
export const PROTOCOL_FEE_BPS = 50;
export const PROTOCOL_FEE_RATE = PROTOCOL_FEE_BPS / 10000;

/**
 * Compute the fee in lamports using floor division — matches the on-chain
 * `compute_fee_lamports` in `../adler-program/programs/adler-escrow/src/state/protocol_config.rs`.
 */
export function computeFeeLamports(totalLamports: number): number {
    return Math.floor((totalLamports * PROTOCOL_FEE_BPS) / 10000);
}

export function computeFeeSol(amountSol: number): number {
    return amountSol * PROTOCOL_FEE_RATE;
}

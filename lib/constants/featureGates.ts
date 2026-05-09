/** Use mock data in development. Set to false to use real Firebase in dev. */
export const USE_DEV_DATA = false;

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

/**
 * Fee treasury address. Required in production builds; we hard-fail here
 * rather than risk routing fees to whatever default the bundle was built
 * with. Devnet builds may run without it (the on-chain program reads
 * `ProtocolConfig.fee_treasury` regardless).
 */
const RAW_FEE_TREASURY = process.env.EXPO_PUBLIC_FEE_TREASURY_ADDRESS;
if (!RAW_FEE_TREASURY && SOLANA_NETWORK === 'mainnet-beta') {
    throw new Error(
        'EXPO_PUBLIC_FEE_TREASURY_ADDRESS is required for mainnet builds.',
    );
}
export const FEE_TREASURY_ADDRESS: string | null = RAW_FEE_TREASURY ?? null;

/** Use mock data in development. Set to false to use real Firebase in dev. */
export const USE_DEV_DATA = false;

/** Solana network for payments. Devnet for v1; flip to mainnet-beta in production. */
export const SOLANA_NETWORK = 'devnet' as const;
export const SOLANA_RPC_URL = 'https://api.devnet.solana.com';
export const SOLANA_EXPLORER_BASE = 'https://explorer.solana.com';

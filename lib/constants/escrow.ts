import { PublicKey } from '@solana/web3.js';
import { SOLANA_NETWORK, type SolanaNetwork } from './featureGates';

// Adler bounty escrow program. Devnet only on v1; mainnet entry holds the
// same id pending audit + Squads multisig upgrade authority.
const PROGRAM_IDS: Record<SolanaNetwork, string> = {
  devnet: 'BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr',
  'mainnet-beta': 'BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr',
  testnet: 'BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr',
};

export const V1_PROGRAM_ID = new PublicKey(PROGRAM_IDS[SOLANA_NETWORK]);

/** 30 days. Mirrors `BOUNTY_EXPIRY_SECS` in the on-chain program. */
export const BOUNTY_EXPIRY_SECS = 30 * 24 * 60 * 60;

/** Per [spec] auto-mode submission cap. Enforced client + server. */
export const MAX_AUTO_SUBMISSIONS_PER_USER = 3;

export const BountyMode = {
  Manual: 0,
  Auto: 1,
} as const;

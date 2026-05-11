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

/** Fixed 30-day submission window. */
export const SUBMISSION_WINDOW_SECS = 30 * 24 * 60 * 60;

/** Fixed 90-day review window after submissions close. Mirrors the
 *  `REVIEW_WINDOW_SECS` Rust constant in the on-chain program — changing
 *  this requires a program redeploy. */
export const REVIEW_WINDOW_SECS = 90 * 24 * 60 * 60;

/** Hard cap: one submission per user per bounty. */
export const MAX_SUBMISSIONS_PER_USER = 1;

/** Mode byte passed to the on-chain `create_bounty` ix. Manual only in v1. */
export const BOUNTY_MODE_MANUAL = 0;

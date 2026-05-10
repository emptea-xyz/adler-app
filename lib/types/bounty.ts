// Mirror of the `bounties/{id}` Firestore doc shape. Source of truth:
// `match /bounties/{id}` in firestore.rules.
//
// All timestamps are unix ms once read into memory.

export type BountyMode = 'manual' | 'auto';
export type BountyStatus = 'open' | 'hidden' | 'settled' | 'refunded';
export type BountyScope = 'public' | 'group';

export interface Bounty {
  id: string;
  posterId: string;
  /** Snapshotted at create time. The verifier + manual-settle paths
   *  derive PDAs from this; profile.walletAddress can drift but this
   *  is the canonical wallet that funded the on-chain escrow. */
  posterWalletAddress: string;
  title: string;
  prompt: string;
  mode: BountyMode;
  /** Integer lamports. Display via formatSol(lamports / 1e9). */
  bountyLamports: number;
  createdAt: number;
  /** createdAt + 30 days. After this, refundBounty() can be called by anyone. */
  expiresAt: number;
  status: BountyStatus;
  scope: BountyScope;
  /** Set when scope === 'group'. */
  groupId: string | null;
  winnerId: string | null;
  winningSubmissionId: string | null;
  /** Settle/refund tx signature on devnet. */
  txSignature: string | null;
  reportCount: number;
  /** Hex 32-byte deterministic id used as Anchor PDA seed. Derived from `id`. */
  contractIdHex: string;
  /** Flips true once the on-chain createBounty ix lands. */
  escrowFunded: boolean;
}

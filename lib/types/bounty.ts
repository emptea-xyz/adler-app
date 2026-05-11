// Mirror of the `bounties/{id}` Firestore doc shape. Source of truth:
// `match /bounties/{id}` in firestore.rules.
//
// All timestamps are unix ms once read into memory.

/** `open` → accepting submissions (30d).
 *  `in_review` → submission window closed, poster has the 90-day review
 *    window to pick a winner.
 *  `cancelling` → transient lock held by the poster while their on-chain
 *    `cancel_bounty` ix is in flight. Blocks new submissions atomically;
 *    rolled back to the prior status if the ix fails. */
export type BountyStatus =
    | 'open'
    | 'in_review'
    | 'cancelling'
    | 'hidden'
    | 'settled'
    | 'refunded';
export type BountyScope = 'public' | 'group';
/** What the poster wants submitters to send. All formats are reviewed
 *  manually by the poster — no AI verifier on any of them. */
export type BountySubmissionKind = 'photo' | 'video' | 'link';

export interface Bounty {
    id: string;
    posterId: string;
    /** Snapshotted at create time. Manual-settle / cancel paths derive
     *  PDAs from this; profile.walletAddress can drift but this is the
     *  canonical wallet that funded the on-chain escrow. */
    posterWalletAddress: string;
    title: string;
    prompt: string;
    /** Integer lamports. Display via formatSol(lamports / 1e9). */
    bountyLamports: number;
    createdAt: number;
    /** createdAt + 30 days. After this, no more submissions. */
    submissionEndsAt: number;
    /** submissionEndsAt + 90-day review window. After this, refundBounty()
     *  can be called by anyone and the poster can no longer settle. */
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
    /** Denormalized submission count maintained by the
     *  `enforceSubmissionCap` Cloud Function. Gates client-side cancel. */
    submissionCount: number;
    /** What submitters send back: photo, video, or link. */
    submissionKind: BountySubmissionKind;
}

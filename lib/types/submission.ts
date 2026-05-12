// Mirror of the `submissions/{id}` Firestore doc shape. Source of truth:
// `match /submissions/{id}` in firestore.rules.

import type { BountyScope, BountyStatus, BountySubmissionKind } from './bounty';

export interface Submission {
    id: string;
    bountyId: string;
    submitterId: string;
    /** Public Firebase Storage URL for photo submissions. Empty string
     *  when the parent bounty's submissionKind !== 'photo'. */
    photoUrl: string;
    photoStoragePath: string;
    /** Public Firebase Storage URL for video submissions. Empty string
     *  when the parent bounty's submissionKind !== 'video'. */
    videoUrl: string;
    videoStoragePath: string;
    /** URL submitted for 'link'-kind bounties. null otherwise. */
    linkUrl: string | null;
    submittedAt: number;
    isWinner: boolean;
    bountyTitle?: string;
    bountyLamports?: number;
    bountyStatus?: BountyStatus;
    bountyPosterId?: string;
    bountySubmissionKind?: BountySubmissionKind;
    bountyScope?: BountyScope;
    bountyGroupId?: string | null;
}

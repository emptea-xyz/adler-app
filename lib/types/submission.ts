// Mirror of the `submissions/{id}` Firestore doc shape. Source of truth:
// `match /submissions/{id}` in firestore.rules.

export type AiVerdict = 'pass' | 'fail';

export interface Submission {
  id: string;
  bountyId: string;
  submitterId: string;
  /** Public Firebase Storage URL (the verifier Cloud Function fetches it). */
  photoUrl: string;
  photoStoragePath: string;
  submittedAt: number;
  aiVerdict: AiVerdict | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  isWinner: boolean;
}

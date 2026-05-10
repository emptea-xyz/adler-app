// Mirror of the `reports/{id}` Firestore doc shape. Doc id is deterministic
// `${bountyId}_${reporterId}` so a single user can only report a bounty once.

export interface Report {
  id: string;
  bountyId: string;
  reporterId: string;
  reason: string;
  createdAt: number;
}

// Mirror of the group-related Firestore docs. Sources of truth:
// `match /groups/{id}`, `match /groupMembers/{compoundId}`,
// `match /joinRequests/{id}` in firestore.rules. (There is no
// `groupCreationRequests` collection — v1 has no self-service create
// flow; super-admin provisions groups via `createGroup`.)

export type GroupStatus = 'pending' | 'active';
export type GroupRole = 'admin' | 'member';

export interface Group {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: number;
  status: GroupStatus;
  memberCount: number;
  /** Sum of bountyLamports across open group bounties. Maintained by
   *  Cloud Function; clients display only. */
  openBountyTotalLamports: number;
  /** Optional avatar/logo URL; falls back to an initial circle in the UI. */
  logoUrl?: string | null;
  /** Admin-curated rules / about copy. Empty string when unset. Max 1000 chars. */
  rules: string;
  /** Id of a pinned bounty surfaced at the top of the Bounties tab. Cleared
   *  server-side when that bounty closes (settle/refund/cancel/hidden). */
  pinnedBountyId: string | null;
}

export interface GroupMember {
  /** Doc id is `${groupId}_${uid}`. */
  id: string;
  groupId: string;
  uid: string;
  joinedAt: number;
  /**
   * Initial admin is seeded by super-admin via `createGroup`. Admins
   * can promote/demote in-app via the `transferGroupOwnership` callable.
   */
  role: GroupRole;
}

export interface JoinRequest {
  /** Doc id is `${groupId}_${uid}`. */
  id: string;
  groupId: string;
  uid: string;
  createdAt: number;
}

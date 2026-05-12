// Mirror of the `profiles/{userId}` Firestore doc shape. Source of truth:
// `match /profiles/{userId}` in firestore.rules.
//
// No role split (no creatorProfile / brandProfile / isCreator / isBrand) —
// every authenticated user can post a bounty, submit, and win.

export interface ProfileLocation {
  kind: 'country' | 'global';
  /** ISO-3166-1 alpha-2, uppercase. Required when kind === 'country'. */
  country: string | null;
}

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  walletAddress: string | null;
  pushToken?: string | null;
  /** Defaults to { kind: 'global', city: null, country: null } until the
   *  user picks a location during onboarding or in settings. */
  location: ProfileLocation;
  /** Denormalized count of `groupMembers` rows for this uid. Maintained by
   *  Cloud Function; clients read for the Profile screen badge. */
  groupCount: number;
  latestActivityAt: number;
  createdAt: number;
  updatedAt: number;
  /** Unix ms of the last username change. 0 = never changed. Used to gate
   *  the 30-day cooldown — enforced both client-side and by firestore.rules. */
  lastUsernameChangeAt: number;
}

/** Username can be changed once every 30 days. */
export const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export const DEFAULT_LOCATION: ProfileLocation = {
  kind: 'global',
  country: null,
};

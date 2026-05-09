// Mirror of adler-website/lib/types/profile.ts. Source of truth for the
// `profiles/{userId}` doc shape lives in adler-app/firestore.rules; this
// type must stay in lockstep. Timestamps are unix ms once read into
// memory; Firestore stores them as Timestamp objects.

export type ViewMode = "creator" | "brand";

export type SocialPlatform = "instagram" | "youtube" | "tiktok" | "twitter";

export interface SocialLink {
  platform: SocialPlatform;
  /** Canonical handle, no leading @ and no URL prefix. */
  handle: string;
}

/**
 * Opt-in contact channels for cold DMs. `dmContact === null` means "not
 * open to cold DMs". Stored as null when every channel is empty (the rules
 * forbid an all-null map; directory queries assume null = closed).
 */
export interface DmContact {
  email: string | null;
  telegram: string | null;
  phone: string | null;
}

export interface CreatorProfile {
  niches: string[];
  portfolioUrl: string | null;
  socialLinks: SocialLink[];
  dmContact: DmContact | null;
}

export interface BrandProfile {
  companyName: string;
  industry: string | null;
  websiteUrl: string | null;
  dmContact: DmContact | null;
}

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  walletAddress: string | null;
  pushToken: string | null;
  /** ISO-3166-1 alpha-2, uppercase. null = "Global". */
  country: string | null;
  creatorProfile: CreatorProfile | null;
  brandProfile: BrandProfile | null;
  /**
   * Denormalized booleans that mirror `creatorProfile != null` and
   * `brandProfile != null`. Required so directory queries can equality-
   * filter (Firestore can't `!=` map fields). The writers in
   * profileService.ts keep them in lockstep; the rules enforce the same
   * invariant on the server (validProfileRoleFlag).
   */
  isCreator: boolean;
  isBrand: boolean;
  latestActivityAt: number;
  createdAt: number;
  updatedAt: number;
}

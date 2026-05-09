// Stub. Public profile directory queries are implemented in step 2 (browse
// + detail screens) — listing creators by niche and brands by industry,
// resolving handle → uid → profile.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Profile } from '@/lib/types/profile';

const NOT_IMPLEMENTED = (fn: string) =>
    new Error(`directoryService.${fn} is not implemented yet (step 2).`);

export interface BrandListing {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    country: string | null;
    companyName: string;
    industry: string | null;
    hasDmContact: boolean;
    latestActivityAt: number;
}

export interface CreatorListing {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    country: string | null;
    niches: string[];
    hasDmContact: boolean;
    latestActivityAt: number;
}

export async function listBrands(_opts?: {
    industry?: string | null;
    pageSize?: number;
}): Promise<{ items: BrandListing[]; nextCursor: null }> {
    throw NOT_IMPLEMENTED('listBrands');
}

export async function listCreators(_opts?: {
    niche?: string | null;
    pageSize?: number;
}): Promise<{ items: CreatorListing[]; nextCursor: null }> {
    throw NOT_IMPLEMENTED('listCreators');
}

/**
 * Resolve a handle to the underlying profile via the public usernames/
 * collection, then load the profile. Returns null if either lookup fails.
 *
 * Used by the public profile screen in step 2. Implemented now (rather
 * than stubbed) because it's just a two-doc fetch and the route renaming
 * step plumbs it through.
 */
export async function getProfileByHandle(
    handle: string,
): Promise<Profile | null> {
    const slug = handle.trim().toLowerCase();
    if (!slug) return null;
    const slugSnap = await getDoc(doc(db, 'usernames', slug));
    if (!slugSnap.exists()) return null;
    const userId = slugSnap.data()?.userId;
    if (typeof userId !== 'string' || !userId) return null;

    const profileSnap = await getDoc(doc(db, 'profiles', userId));
    if (!profileSnap.exists()) return null;
    const data = profileSnap.data() as Record<string, unknown>;

    // Minimal in-place reader. The full profile reader (with sub-profile
    // normalization etc.) lives in profileService; importing it here would
    // create a circular dep. The simple shape below is enough for the
    // public profile screen (step 2) to render.
    return {
        id: profileSnap.id,
        username: (data.username as string) ?? '',
        displayName: (data.displayName as string) ?? '',
        bio: (data.bio as string) ?? '',
        avatarUrl: (data.avatarUrl as string | undefined) ?? null,
        walletAddress: (data.walletAddress as string | undefined) ?? null,
        pushToken: null, // never expose another user's push token
        country: (data.country as string | undefined) ?? null,
        creatorProfile: (data.creatorProfile ?? null) as Profile['creatorProfile'],
        brandProfile: (data.brandProfile ?? null) as Profile['brandProfile'],
        isCreator: typeof data.isCreator === 'boolean' ? data.isCreator : false,
        isBrand: typeof data.isBrand === 'boolean' ? data.isBrand : false,
        latestActivityAt: (data.latestActivityAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0,
        createdAt: (data.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0,
        updatedAt: (data.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0,
    };
}

import {
    doc,
    getDoc,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import type {
    BrandProfile,
    CreatorProfile,
    DmContact,
    Profile,
    SocialLink,
    SocialPlatform,
} from '@/lib/types/profile';
import { tsMs } from '@/lib/utils/firestoreTimestamp';
import { isSameSocialLink, SOCIAL_PLATFORMS } from '@/lib/utils/socialLinks';

// IMPORTANT: collection name + document shape must stay in lockstep with
// adler-website/lib/services/profileService.ts and the deployed
// firestore.rules in this repo. Any divergence triggers
// "Missing or insufficient permissions" at write time.
const COLLECTION = 'profiles';
const USERNAMES_COLLECTION = 'usernames';
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const ADJECTIVES = [
    'Lunar', 'Solar', 'Crimson', 'Indigo', 'Velvet', 'Neon', 'Quartz', 'Onyx',
    'Coral', 'Mirage', 'Echo', 'Drift', 'Vapor', 'Ember', 'Nova', 'Cipher',
] as const;

const NOUNS = [
    'Studio', 'Lab', 'Atelier', 'Forge', 'Loft', 'Press', 'Foundry', 'Frame',
    'Reel', 'Lens', 'Pulse', 'Wave', 'Cell', 'Crew', 'Field', 'Range',
] as const;

function pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generated username embeds a 4-char suffix derived from the userId so the
 * chance of collision in the `usernames/` reservation collection is
 * essentially zero. Falls back to a random suffix if the userId is too
 * short.
 */
function generateUsername(userId: string): string {
    const adj = pick(ADJECTIVES).toLowerCase();
    const noun = pick(NOUNS).toLowerCase();
    const idTail = userId.replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase();
    const suffix = idTail.length >= 4
        ? idTail
        : Math.floor(1000 + Math.random() * 9000).toString();
    return `${adj}${noun}${suffix}`;
}

function generateDisplayName(): string {
    return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

function readSocialLinks(value: unknown): SocialLink[] {
    if (!Array.isArray(value)) return [];
    const valid = SOCIAL_PLATFORMS as readonly SocialPlatform[];
    const out: SocialLink[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue;
        const row = raw as Record<string, unknown>;
        const platform = row.platform;
        const handle = row.handle;
        if (
            typeof platform !== 'string' ||
            typeof handle !== 'string' ||
            !valid.includes(platform as SocialPlatform) ||
            handle.trim() === ''
        ) {
            continue;
        }
        const link: SocialLink = {
            platform: platform as SocialPlatform,
            handle: handle.trim(),
        };
        if (!out.some((l) => isSameSocialLink(l, link))) out.push(link);
    }
    return out;
}

/**
 * `dmContact === null` means "not open to cold DMs". An object with every
 * field empty is forbidden by the rules; null collapses are done at write
 * time, not read time.
 */
function readDmContact(value: unknown): DmContact | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as Record<string, unknown>;
    const email = typeof data.email === 'string' && data.email !== '' ? data.email : null;
    const telegram =
        typeof data.telegram === 'string' && data.telegram !== '' ? data.telegram : null;
    const phone = typeof data.phone === 'string' && data.phone !== '' ? data.phone : null;
    if (!email && !telegram && !phone) return null;
    return { email, telegram, phone };
}

function readCreatorProfile(value: unknown): CreatorProfile | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as Record<string, unknown>;
    return {
        niches: Array.isArray(data.niches) ? (data.niches as string[]) : [],
        portfolioUrl: (data.portfolioUrl as string | undefined) ?? null,
        socialLinks: readSocialLinks(data.socialLinks),
        dmContact: readDmContact(data.dmContact),
    };
}

function readBrandProfile(value: unknown): BrandProfile | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as Record<string, unknown>;
    // companyName is the only required field; without it we treat the
    // section as not yet set up (matches the web reader).
    const companyName = data.companyName as string | undefined;
    if (!companyName) return null;
    return {
        companyName,
        industry: (data.industry as string | undefined) ?? null,
        websiteUrl: (data.websiteUrl as string | undefined) ?? null,
        dmContact: readDmContact(data.dmContact),
    };
}

function rowToProfile(id: string, data: Record<string, unknown>): Profile {
    const creatorProfile = readCreatorProfile(data.creatorProfile);
    const brandProfile = readBrandProfile(data.brandProfile);
    // Prefer persisted booleans when present (so a write that hasn't
    // re-synced yet still reads correctly), otherwise derive from the
    // sub-profile presence. Older docs predating the flags fall through to
    // the derived value automatically.
    const persistedIsCreator =
        typeof data.isCreator === 'boolean' ? data.isCreator : null;
    const persistedIsBrand =
        typeof data.isBrand === 'boolean' ? data.isBrand : null;
    return {
        id,
        username: (data.username as string | undefined) ?? '',
        displayName: (data.displayName as string | undefined) ?? '',
        bio: (data.bio as string | undefined) ?? '',
        avatarUrl: (data.avatarUrl as string | undefined) ?? null,
        walletAddress: (data.walletAddress as string | undefined) ?? null,
        pushToken: (data.pushToken as string | undefined) ?? null,
        country: (data.country as string | undefined) ?? null,
        creatorProfile,
        brandProfile,
        isCreator: persistedIsCreator ?? creatorProfile !== null,
        isBrand: persistedIsBrand ?? brandProfile !== null,
        latestActivityAt: tsMs(data.latestActivityAt),
        createdAt: tsMs(data.createdAt) || Date.now(),
        updatedAt: tsMs(data.updatedAt) || Date.now(),
    };
}

/**
 * Public availability check — used by the EditProfileSheet to validate a
 * desired username before submit. Best-effort: a value can be claimed in
 * the window between check and write, in which case the transactional
 * update will surface the conflict.
 */
export async function isUsernameAvailable(
    username: string,
    exceptUserId: string,
): Promise<boolean> {
    if (!USERNAME_REGEX.test(username)) return false;
    const snap = await getDoc(doc(db, USERNAMES_COLLECTION, username));
    if (!snap.exists()) return true;
    return snap.data()?.userId === exceptUserId;
}

export async function getProfile(userId: string): Promise<Profile | null> {
    const snap = await getDoc(doc(db, COLLECTION, userId));
    if (!snap.exists()) return null;
    return rowToProfile(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Idempotent profile bootstrap. Mirrors the web implementation: creates a
 * profile + reserves the username slug atomically the first time we see
 * this user, otherwise backfills walletAddress and missing username
 * claims.
 */
export async function ensureProfileExists(
    userId: string,
    walletAddress: string | null,
): Promise<Profile> {
    const ref = doc(db, COLLECTION, userId);

    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);

        if (snap.exists()) {
            const data = snap.data();
            const existingUsername = data.username as string | undefined;

            // All reads must precede writes inside a transaction.
            let backfillUsernameClaim = false;
            if (existingUsername) {
                const slugRef = doc(db, USERNAMES_COLLECTION, existingUsername);
                const slugSnap = await tx.get(slugRef);
                backfillUsernameClaim = !slugSnap.exists();
            }

            if (walletAddress && !data.walletAddress) {
                tx.update(ref, { walletAddress, updatedAt: serverTimestamp() });
            }
            if (backfillUsernameClaim && existingUsername) {
                tx.set(doc(db, USERNAMES_COLLECTION, existingUsername), {
                    userId,
                    createdAt: serverTimestamp(),
                });
            }

            return rowToProfile(snap.id, {
                ...data,
                walletAddress:
                    walletAddress ?? (data.walletAddress as string | undefined) ?? null,
                updatedAt: Date.now(),
            });
        }

        const username = generateUsername(userId);
        const slugRef = doc(db, USERNAMES_COLLECTION, username);
        const slugSnap = await tx.get(slugRef);
        if (slugSnap.exists()) {
            // Astronomically unlikely with the userId-suffix scheme, but we
            // surface a clear error rather than silently overwriting.
            throw new Error(
                `Generated username ${username} collided. Try signing in again.`,
            );
        }

        const displayName = generateDisplayName();
        const now = Date.now();
        tx.set(slugRef, { userId, createdAt: serverTimestamp() });
        tx.set(ref, {
            username,
            displayName,
            bio: '',
            avatarUrl: null,
            walletAddress,
            pushToken: null,
            country: null,
            creatorProfile: null,
            brandProfile: null,
            isCreator: false,
            isBrand: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return {
            id: userId,
            username,
            displayName,
            bio: '',
            avatarUrl: null,
            walletAddress,
            pushToken: null,
            country: null,
            creatorProfile: null,
            brandProfile: null,
            isCreator: false,
            isBrand: false,
            latestActivityAt: 0,
            createdAt: now,
            updatedAt: now,
        };
    });
}

function assertCurrentUser(userId: string) {
    if (auth.currentUser?.uid !== userId) {
        throw new Error('Cannot update profile for another user');
    }
}

/**
 * Update the user-editable identity fields. `displayName` and `bio` are
 * both seeded by `ensureProfileExists` (random adjective+noun, empty bio)
 * and otherwise managed entirely from the profile-settings page. Username
 * is intentionally not editable here — renaming requires migrating the
 * `usernames/{slug}` reservation transactionally and is out of scope for
 * v1.
 */
export async function updateProfileBasics(
    userId: string,
    patch: { displayName?: string; bio?: string },
): Promise<void> {
    assertCurrentUser(userId);
    const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.displayName !== undefined) update.displayName = patch.displayName;
    if (patch.bio !== undefined) update.bio = patch.bio;
    await updateDoc(doc(db, COLLECTION, userId), update);
}

export async function setCountry(
    userId: string,
    country: string | null,
): Promise<void> {
    assertCurrentUser(userId);
    await updateDoc(doc(db, COLLECTION, userId), {
        country,
        updatedAt: serverTimestamp(),
    });
}

export interface CompleteOnboardingInput {
    displayName: string;
    bio: string;
    country: string | null;
    creatorProfile: CreatorProfile;
    brandProfile: BrandProfile;
}

export async function completeDualProfileOnboarding(
    userId: string,
    input: CompleteOnboardingInput,
): Promise<void> {
    assertCurrentUser(userId);
    const ref = doc(db, COLLECTION, userId);
    const batch = writeBatch(db);
    batch.update(ref, {
        displayName: input.displayName,
        bio: input.bio,
        country: input.country,
        creatorProfile: {
            ...input.creatorProfile,
            dmContact: normalizeDmContact(input.creatorProfile.dmContact),
        },
        brandProfile: {
            ...input.brandProfile,
            dmContact: normalizeDmContact(input.brandProfile.dmContact),
        },
        isCreator: true,
        isBrand: true,
        updatedAt: serverTimestamp(),
    });
    await batch.commit();
}

export async function setAvatarUrl(
    userId: string,
    avatarUrl: string | null,
): Promise<void> {
    assertCurrentUser(userId);
    await updateDoc(doc(db, COLLECTION, userId), {
        avatarUrl,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Collapse an incoming `DmContact` patch to either a fully-populated
 * object (with empty strings normalised to `null`) or `null` if every
 * channel is blank. Mirrors the `readDmContact` invariant.
 */
function normalizeDmContact(value: DmContact | null | undefined): DmContact | null {
    if (!value) return null;
    const email = value.email && value.email.trim() !== '' ? value.email.trim() : null;
    const telegram =
        value.telegram && value.telegram.trim() !== ''
            ? value.telegram.trim().replace(/^@/, '')
            : null;
    const phone = value.phone && value.phone.trim() !== '' ? value.phone.trim() : null;
    if (!email && !telegram && !phone) return null;
    return { email, telegram, phone };
}

/**
 * Pass a partial patch to merge fields into the creator section, or
 * `null` to clear it entirely. Keeps the denormalized `isCreator` flag in
 * lockstep with `creatorProfile != null` — directory queries depend on
 * this and the rule enforces it.
 */
export async function updateCreatorProfile(
    userId: string,
    patch: Partial<CreatorProfile> | null,
): Promise<void> {
    assertCurrentUser(userId);
    const ref = doc(db, COLLECTION, userId);

    if (patch === null) {
        await updateDoc(ref, {
            creatorProfile: null,
            isCreator: false,
            updatedAt: serverTimestamp(),
        });
        return;
    }

    const snap = await getDoc(ref);
    const existing = snap.exists()
        ? readCreatorProfile((snap.data() as Record<string, unknown>).creatorProfile)
        : null;
    // Dedupe on write — defence in depth against UIs that don't enforce
    // uniqueness on add.
    const incomingLinks = patch.socialLinks ?? existing?.socialLinks ?? [];
    const dedupedLinks: SocialLink[] = [];
    for (const link of incomingLinks) {
        if (!dedupedLinks.some((l) => isSameSocialLink(l, link))) {
            dedupedLinks.push(link);
        }
    }
    const dmContact = normalizeDmContact(
        patch.dmContact !== undefined ? patch.dmContact : existing?.dmContact ?? null,
    );
    const next: CreatorProfile = {
        niches: patch.niches ?? existing?.niches ?? [],
        portfolioUrl: patch.portfolioUrl ?? existing?.portfolioUrl ?? null,
        socialLinks: dedupedLinks,
        dmContact,
    };
    await updateDoc(ref, {
        creatorProfile: next,
        isCreator: true,
        updatedAt: serverTimestamp(),
    });
}

export async function updateBrandProfile(
    userId: string,
    patch: Partial<BrandProfile> | null,
): Promise<void> {
    assertCurrentUser(userId);
    const ref = doc(db, COLLECTION, userId);

    if (patch === null) {
        await updateDoc(ref, {
            brandProfile: null,
            isBrand: false,
            updatedAt: serverTimestamp(),
        });
        return;
    }

    const snap = await getDoc(ref);
    const existing = snap.exists()
        ? readBrandProfile((snap.data() as Record<string, unknown>).brandProfile)
        : null;
    const companyName = patch.companyName ?? existing?.companyName;
    if (!companyName) {
        throw new Error('Brand profile requires a company name');
    }
    const dmContact = normalizeDmContact(
        patch.dmContact !== undefined ? patch.dmContact : existing?.dmContact ?? null,
    );
    const next: BrandProfile = {
        companyName,
        industry: patch.industry ?? existing?.industry ?? null,
        websiteUrl: patch.websiteUrl ?? existing?.websiteUrl ?? null,
        dmContact,
    };
    await updateDoc(ref, {
        brandProfile: next,
        isBrand: true,
        updatedAt: serverTimestamp(),
    });
}

export async function setWalletAddress(
    userId: string,
    walletAddress: string,
): Promise<void> {
    assertCurrentUser(userId);
    // Append-only by the rule: walletAddress can flip from null → string
    // but never be overwritten. Clients fall back to the existing value.
    await setDoc(
        doc(db, COLLECTION, userId),
        { walletAddress, updatedAt: serverTimestamp() },
        { merge: true },
    );
}

/**
 * Persist the user's Expo push token. Idempotent — caller debounces so we
 * don't spam Firestore on every app foreground.
 */
export async function setPushToken(userId: string, pushToken: string): Promise<void> {
    assertCurrentUser(userId);
    await setDoc(
        doc(db, COLLECTION, userId),
        { pushToken, updatedAt: serverTimestamp() },
        { merge: true },
    );
}

/**
 * Clear the push token on sign-out so notifications don't fire to a
 * device that's no longer signed in. Best-effort — caller swallows
 * failures.
 */
export async function clearPushToken(userId: string): Promise<void> {
    assertCurrentUser(userId);
    await setDoc(
        doc(db, COLLECTION, userId),
        { pushToken: null, updatedAt: serverTimestamp() },
        { merge: true },
    );
}

// Re-exported so step-2 edit flows can validate before hitting the
// network. Mirrors the regex baked into the Firestore rules.
export const USERNAME_PATTERN = USERNAME_REGEX;

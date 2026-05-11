import {
    doc,
    getDoc,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import {
    DEFAULT_LOCATION,
    USERNAME_COOLDOWN_MS,
    type Profile,
    type ProfileLocation,
} from '@/lib/types/profile';
import { tsMs } from '@/lib/utils/firestoreTimestamp';

// IMPORTANT: collection name + document shape must stay in lockstep with
// the deployed firestore.rules. Any divergence triggers
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

function readLocation(value: unknown): ProfileLocation {
    if (!value || typeof value !== 'object') return DEFAULT_LOCATION;
    const raw = value as Record<string, unknown>;
    // Accept both the current shape (kind: 'country') and the legacy
    // shape (kind: 'city', { city, country }) — for legacy docs we just
    // drop the city and keep the country code.
    const country = typeof raw.country === 'string' ? raw.country : null;
    if (raw.kind === 'global' || !country || country.length !== 2) {
        return DEFAULT_LOCATION;
    }
    return { kind: 'country', country: country.toUpperCase() };
}

function rowToProfile(uid: string, data: Record<string, unknown>): Profile {
    return {
        id: uid,
        username: (data.username as string) ?? '',
        displayName: (data.displayName as string) ?? '',
        bio: (data.bio as string) ?? '',
        avatarUrl: (data.avatarUrl as string | null) ?? null,
        walletAddress: (data.walletAddress as string | null) ?? null,
        pushToken: (data.pushToken as string | null) ?? null,
        location: readLocation(data.location),
        groupCount: typeof data.groupCount === 'number' ? data.groupCount : 0,
        latestActivityAt: tsMs(data.latestActivityAt),
        createdAt: tsMs(data.createdAt) || Date.now(),
        updatedAt: tsMs(data.updatedAt) || Date.now(),
        lastUsernameChangeAt: tsMs(data.lastUsernameChangeAt),
    };
}

function assertCurrentUser(userId: string): void {
    const current = auth.currentUser?.uid;
    if (!current || current !== userId) {
        throw new Error('Profile mutation requires authentication');
    }
}

export async function isUsernameAvailable(
    username: string,
    exceptUserId?: string,
): Promise<boolean> {
    const slug = username.trim().toLowerCase();
    if (!USERNAME_REGEX.test(slug)) return false;
    const snap = await getDoc(doc(db, USERNAMES_COLLECTION, slug));
    if (!snap.exists()) return true;
    if (exceptUserId && snap.data()?.userId === exceptUserId) return true;
    return false;
}

export async function getProfile(userId: string): Promise<Profile | null> {
    const snap = await getDoc(doc(db, COLLECTION, userId));
    if (!snap.exists()) return null;
    return rowToProfile(userId, snap.data() as Record<string, unknown>);
}

/**
 * Idempotent profile bootstrap. Reserves the username slug atomically the
 * first time we see this user; backfills walletAddress and missing slug
 * claims on subsequent calls.
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

            let backfillUsernameClaim = false;
            if (existingUsername) {
                const slugRef = doc(db, USERNAMES_COLLECTION, existingUsername);
                const slugSnap = await tx.get(slugRef);
                backfillUsernameClaim = !slugSnap.exists();
            }

            // Backfill missing/legacy fields on existing profiles so subsequent
            // writes (push token, profile edits) pass the rule's strict
            // validation. Migrates legacy `{kind: 'city', city, country}` to
            // the new country-only shape.
            const patch: Record<string, unknown> = {};
            if (walletAddress && !data.walletAddress) patch.walletAddress = walletAddress;
            const loc = data.location as Record<string, unknown> | undefined;
            if (!loc) {
                patch.location = DEFAULT_LOCATION;
            } else if (loc.kind === 'city') {
                const country = typeof loc.country === 'string' ? loc.country : null;
                patch.location = country && country.length === 2
                    ? { kind: 'country', country: country.toUpperCase() }
                    : DEFAULT_LOCATION;
            }
            if (typeof data.groupCount !== 'number') patch.groupCount = 0;
            if (Object.keys(patch).length > 0) {
                tx.update(ref, { ...patch, updatedAt: serverTimestamp() });
            }
            if (backfillUsernameClaim && existingUsername) {
                tx.set(doc(db, USERNAMES_COLLECTION, existingUsername), {
                    userId,
                    createdAt: serverTimestamp(),
                });
            }

            return rowToProfile(snap.id, {
                ...data,
                ...patch,
                walletAddress:
                    walletAddress ?? (data.walletAddress as string | undefined) ?? null,
                updatedAt: Date.now(),
            });
        }

        const username = generateUsername(userId);
        const slugRef = doc(db, USERNAMES_COLLECTION, username);
        const slugSnap = await tx.get(slugRef);
        if (slugSnap.exists()) {
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
            location: DEFAULT_LOCATION,
            groupCount: 0,
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
            location: DEFAULT_LOCATION,
            groupCount: 0,
            latestActivityAt: 0,
            createdAt: now,
            updatedAt: now,
            lastUsernameChangeAt: 0,
        };
    });
}

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

export async function setLocation(
    userId: string,
    location: ProfileLocation,
): Promise<void> {
    assertCurrentUser(userId);
    const sanitized: ProfileLocation =
        location.kind === 'country' && location.country && location.country.length === 2
            ? { kind: 'country', country: location.country.toUpperCase() }
            : DEFAULT_LOCATION;
    await updateDoc(doc(db, COLLECTION, userId), {
        location: sanitized,
        updatedAt: serverTimestamp(),
    });
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
 * Append-only by the rule: walletAddress can flip from null → string but
 * never be overwritten. Clients fall back to the existing value.
 */
export async function setWalletAddress(
    userId: string,
    walletAddress: string,
): Promise<void> {
    assertCurrentUser(userId);
    await setDoc(
        doc(db, COLLECTION, userId),
        { walletAddress, updatedAt: serverTimestamp() },
        { merge: true },
    );
}

/**
 * Atomic username change: claim new slug, release old slug, update profile.
 * Rate-limited to once every 30 days via `lastUsernameChangeAt`; the same
 * cooldown is enforced server-side by `firestore.rules`.
 *
 * Throws on: bad format, taken slug, cooldown active, or profile missing.
 */
export async function changeUsername(userId: string, newUsername: string): Promise<void> {
    assertCurrentUser(userId);
    const slug = newUsername.trim().toLowerCase();
    if (!USERNAME_REGEX.test(slug)) {
        throw new Error('Username must be 3–20 chars: lowercase letters, digits, underscores.');
    }

    const profileRef = doc(db, COLLECTION, userId);
    const newSlugRef = doc(db, USERNAMES_COLLECTION, slug);

    await runTransaction(db, async (tx) => {
        const profileSnap = await tx.get(profileRef);
        if (!profileSnap.exists()) throw new Error('Profile not found.');
        const data = profileSnap.data();
        const oldUsername = data.username as string | undefined;
        if (!oldUsername) throw new Error('Profile has no current username.');
        if (slug === oldUsername) return; // No-op.

        const lastChangeMs = tsMs(data.lastUsernameChangeAt);
        if (lastChangeMs > 0) {
            const elapsed = Date.now() - lastChangeMs;
            if (elapsed < USERNAME_COOLDOWN_MS) {
                const daysLeft = Math.ceil((USERNAME_COOLDOWN_MS - elapsed) / 86400000);
                throw new Error(
                    `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
                );
            }
        }

        const newSlugSnap = await tx.get(newSlugRef);
        if (newSlugSnap.exists()) {
            throw new Error('That username is taken.');
        }

        tx.set(newSlugRef, { userId, createdAt: serverTimestamp() });
        tx.delete(doc(db, USERNAMES_COLLECTION, oldUsername));
        tx.update(profileRef, {
            username: slug,
            lastUsernameChangeAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });
}

export async function setPushToken(userId: string, pushToken: string): Promise<void> {
    assertCurrentUser(userId);
    await setDoc(
        doc(db, COLLECTION, userId),
        { pushToken, updatedAt: serverTimestamp() },
        { merge: true },
    );
}

export async function clearPushToken(userId: string): Promise<void> {
    assertCurrentUser(userId);
    await setDoc(
        doc(db, COLLECTION, userId),
        { pushToken: null, updatedAt: serverTimestamp() },
        { merge: true },
    );
}

export const USERNAME_PATTERN = USERNAME_REGEX;

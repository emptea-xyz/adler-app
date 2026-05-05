import {
    doc,
    getDoc,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import type { Profile, UserRole } from '@/types/marketplace';

const COLLECTION = 'profiles';
const USERNAMES_COLLECTION = 'usernames';
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const ADJECTIVES = [
    'Lunar', 'Solar', 'Crimson', 'Indigo', 'Velvet', 'Neon', 'Quartz', 'Onyx',
    'Coral', 'Mirage', 'Echo', 'Drift', 'Vapor', 'Ember', 'Nova', 'Cipher',
];
const NOUNS = [
    'Studio', 'Lab', 'Atelier', 'Forge', 'Loft', 'Press', 'Foundry', 'Frame',
    'Reel', 'Lens', 'Pulse', 'Wave', 'Cell', 'Crew', 'Field', 'Range',
];

function pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generated username embeds a 4-char suffix derived from the userId so the
 * chance of collision in the `usernames/` reservation collection is
 * essentially zero. Falls back to a random suffix if the userId is too short.
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

/**
 * Public availability check — used by the EditProfileSheet to validate the
 * desired username before submit. Best-effort: a value can be claimed in the
 * window between check and write, in which case the transactional update will
 * surface the conflict.
 */
export async function isUsernameAvailable(username: string, exceptUserId: string): Promise<boolean> {
    if (!USERNAME_REGEX.test(username)) return false;
    const snap = await getDoc(doc(db, USERNAMES_COLLECTION, username));
    if (!snap.exists()) return true;
    return snap.data()?.userId === exceptUserId;
}

export async function getProfile(userId: string): Promise<Profile | null> {
    const snap = await getDoc(doc(db, COLLECTION, userId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        id: snap.id,
        role: data.role ?? null,
        username: data.username,
        displayName: data.displayName,
        bio: data.bio ?? '',
        avatarUrl: data.avatarUrl ?? null,
        walletAddress: data.walletAddress ?? null,
        pushToken: data.pushToken ?? null,
        latestActivityAt: (data.latestActivityAt as Timestamp | undefined)?.toMillis() ?? 0,
        createdAt: (data.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
        updatedAt: (data.updatedAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
    };
}

/**
 * Idempotent profile bootstrap. Creates a profile + reserves the username
 * slug atomically the first time we see this user. Safe to call on every
 * login — also backfills walletAddress and missing username claims for
 * legacy profiles created before the reservation collection existed.
 */
export async function ensureProfileExists(userId: string, walletAddress: string | null): Promise<Profile> {
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

            return {
                id: snap.id,
                role: data.role ?? null,
                username: data.username,
                displayName: data.displayName,
                bio: data.bio ?? '',
                avatarUrl: data.avatarUrl ?? null,
                walletAddress: walletAddress ?? data.walletAddress ?? null,
                pushToken: data.pushToken ?? null,
                latestActivityAt: (data.latestActivityAt as Timestamp | undefined)?.toMillis() ?? 0,
                createdAt: (data.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
                updatedAt: Date.now(),
            };
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
            role: null,
            username,
            displayName,
            bio: '',
            avatarUrl: null,
            walletAddress,
            pushToken: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return {
            id: userId,
            role: null,
            username,
            displayName,
            bio: '',
            avatarUrl: null,
            walletAddress,
            pushToken: null,
            latestActivityAt: 0,
            createdAt: now,
            updatedAt: now,
        };
    });
}

export async function setRole(userId: string, role: UserRole): Promise<void> {
    if (auth.currentUser?.uid !== userId) {
        throw new Error('Cannot set role for another user');
    }
    await updateDoc(doc(db, COLLECTION, userId), {
        role,
        updatedAt: serverTimestamp(),
    });
}

export async function updateProfile(
    userId: string,
    patch: Partial<Pick<Profile, 'displayName' | 'bio' | 'avatarUrl' | 'username'>>,
): Promise<void> {
    if (auth.currentUser?.uid !== userId) {
        throw new Error('Cannot update another user\'s profile');
    }

    if (patch.username !== undefined) {
        if (!USERNAME_REGEX.test(patch.username)) {
            throw new Error('Username must be 3–20 chars, lowercase letters, digits, or underscore.');
        }

        // Username changes flow through a transaction so the slug claim, the
        // old slug release, and the profile write all commit together.
        const profileRef = doc(db, COLLECTION, userId);
        const newSlugRef = doc(db, USERNAMES_COLLECTION, patch.username);

        await runTransaction(db, async (tx) => {
            const profileSnap = await tx.get(profileRef);
            if (!profileSnap.exists()) {
                throw new Error('Profile not found');
            }
            const oldUsername = profileSnap.data()?.username as string | undefined;

            if (oldUsername === patch.username) {
                tx.update(profileRef, { ...patch, updatedAt: serverTimestamp() });
                return;
            }

            const newSlugSnap = await tx.get(newSlugRef);
            if (newSlugSnap.exists() && newSlugSnap.data()?.userId !== userId) {
                throw new Error('That username is taken.');
            }

            if (!newSlugSnap.exists()) {
                tx.set(newSlugRef, { userId, createdAt: serverTimestamp() });
            }
            if (oldUsername && oldUsername !== patch.username) {
                tx.delete(doc(db, USERNAMES_COLLECTION, oldUsername));
            }
            tx.update(profileRef, { ...patch, updatedAt: serverTimestamp() });
        });
        return;
    }

    await updateDoc(doc(db, COLLECTION, userId), {
        ...patch,
        updatedAt: serverTimestamp(),
    });
}

export async function setWalletAddress(userId: string, walletAddress: string): Promise<void> {
    if (auth.currentUser?.uid !== userId) {
        throw new Error('Cannot set wallet for another user');
    }
    await setDoc(
        doc(db, COLLECTION, userId),
        { walletAddress, updatedAt: serverTimestamp() },
        { merge: true },
    );
}

/**
 * Persist the user's Expo push token. Idempotent — caller should debounce so
 * we don't spam Firestore on every app foreground.
 */
export async function setPushToken(userId: string, pushToken: string): Promise<void> {
    if (auth.currentUser?.uid !== userId) {
        throw new Error('Cannot set push token for another user');
    }
    await setDoc(
        doc(db, COLLECTION, userId),
        { pushToken, updatedAt: serverTimestamp() },
        { merge: true },
    );
}

/**
 * Clear the user's push token on sign-out so notifications don't fire to a
 * device that's no longer signed in. Best-effort — caller swallows failures.
 */
export async function clearPushToken(userId: string): Promise<void> {
    if (auth.currentUser?.uid !== userId) {
        throw new Error('Cannot clear push token for another user');
    }
    await setDoc(
        doc(db, COLLECTION, userId),
        { pushToken: null, updatedAt: serverTimestamp() },
        { merge: true },
    );
}

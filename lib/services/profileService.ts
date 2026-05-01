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

function generateUsername(): string {
    const adj = pick(ADJECTIVES).toLowerCase();
    const noun = pick(NOUNS).toLowerCase();
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `${adj}${noun}${suffix}`;
}

function generateDisplayName(): string {
    return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
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
        createdAt: (data.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
        updatedAt: (data.updatedAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
    };
}

/**
 * Idempotent profile bootstrap. Creates a profile with a generated username +
 * displayName the first time we see this user. Safe to call on every login.
 */
export async function ensureProfileExists(userId: string, walletAddress: string | null): Promise<Profile> {
    const ref = doc(db, COLLECTION, userId);

    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) {
            const data = snap.data();
            // Backfill walletAddress if Privy generated it after the profile was created.
            if (walletAddress && !data.walletAddress) {
                tx.update(ref, { walletAddress, updatedAt: serverTimestamp() });
            }
            return {
                id: snap.id,
                role: data.role ?? null,
                username: data.username,
                displayName: data.displayName,
                bio: data.bio ?? '',
                avatarUrl: data.avatarUrl ?? null,
                walletAddress: walletAddress ?? data.walletAddress ?? null,
                createdAt: (data.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
                updatedAt: Date.now(),
            };
        }

        const username = generateUsername();
        const displayName = generateDisplayName();
        const now = Date.now();
        tx.set(ref, {
            role: null,
            username,
            displayName,
            bio: '',
            avatarUrl: null,
            walletAddress,
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

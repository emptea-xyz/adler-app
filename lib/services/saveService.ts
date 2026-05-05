import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    where,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import type { Save, SavedKind } from '@/types/marketplace';

const COLLECTION = 'saves';

/**
 * Deterministic doc id mirrors the rule check — a tampered client cannot
 * write a save under another user's id.
 */
export function saveDocId(userId: string, kind: SavedKind, listingId: string): string {
    return `${userId}_${kind}_${listingId}`;
}

function fromDoc(id: string, data: any): Save {
    return {
        id,
        userId: data.userId,
        kind: data.kind as SavedKind,
        listingId: data.listingId,
        createdAt: (data.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
    };
}

export async function addSave(kind: SavedKind, listingId: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    await setDoc(doc(db, COLLECTION, saveDocId(uid, kind, listingId)), {
        userId: uid,
        kind,
        listingId,
        createdAt: serverTimestamp(),
    });
}

export async function removeSave(kind: SavedKind, listingId: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    await deleteDoc(doc(db, COLLECTION, saveDocId(uid, kind, listingId)));
}

export async function listSavesForUser(userId: string): Promise<Save[]> {
    const q = query(
        collection(db, COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

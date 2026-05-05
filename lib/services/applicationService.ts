import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import type { ApplicationStatus, GigApplication } from '@/types/marketplace';

const COLLECTION = 'gigApplications';

function fromDoc(id: string, data: any): GigApplication {
    return {
        id,
        gigId: data.gigId,
        creatorId: data.creatorId,
        message: data.message ?? '',
        sampleUrls: data.sampleUrls ?? [],
        status: data.status as ApplicationStatus,
        createdAt: (data.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
    };
}

export interface CreateApplicationInput {
    gigId: string;
    message: string;
    sampleUrls: string[];
}

export async function applyToGig(input: CreateApplicationInput): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const ref = await addDoc(collection(db, COLLECTION), {
        gigId: input.gigId,
        creatorId: uid,
        message: input.message,
        sampleUrls: input.sampleUrls,
        status: 'pending' satisfies ApplicationStatus,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function getApplication(applicationId: string): Promise<GigApplication | null> {
    const snap = await getDoc(doc(db, COLLECTION, applicationId));
    if (!snap.exists()) return null;
    return fromDoc(snap.id, snap.data());
}

export async function listApplicationsForGig(gigId: string): Promise<GigApplication[]> {
    const q = query(
        collection(db, COLLECTION),
        where('gigId', '==', gigId),
        orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function listApplicationsByCreator(creatorId: string): Promise<GigApplication[]> {
    const q = query(
        collection(db, COLLECTION),
        where('creatorId', '==', creatorId),
        orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

/**
 * All applications across all gigs owned by a given brand. Implemented as a
 * fan-out over the brand's gig ids in chunks of 30 (Firestore's `in` cap).
 */
export async function listApplicationsForGigIds(gigIds: string[]): Promise<GigApplication[]> {
    if (gigIds.length === 0) return [];
    const CHUNK = 30;
    const results: GigApplication[] = [];
    for (let i = 0; i < gigIds.length; i += CHUNK) {
        const slice = gigIds.slice(i, i + CHUNK);
        const q = query(
            collection(db, COLLECTION),
            where('gigId', 'in', slice),
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) results.push(fromDoc(d.id, d.data()));
    }
    results.sort((a, b) => b.createdAt - a.createdAt);
    return results;
}

export async function updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
): Promise<void> {
    await updateDoc(doc(db, COLLECTION, applicationId), { status });
}

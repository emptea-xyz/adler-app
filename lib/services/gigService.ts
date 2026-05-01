import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit as fsLimit,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import type { Gig, GigStatus } from '@/types/marketplace';

const COLLECTION = 'gigs';

function fromDoc(id: string, data: any): Gig {
    return {
        id,
        brandId: data.brandId,
        title: data.title,
        description: data.description,
        budgetSol: data.budgetSol,
        deadline: (data.deadline as Timestamp | undefined)?.toMillis() ?? null,
        requirements: data.requirements ?? '',
        category: data.category ?? 'general',
        status: data.status as GigStatus,
        createdAt: (data.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
    };
}

export interface CreateGigInput {
    title: string;
    description: string;
    budgetSol: number;
    deadline: number | null;
    requirements: string;
    category: string;
}

export async function createGig(input: CreateGigInput): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const ref = await addDoc(collection(db, COLLECTION), {
        brandId: uid,
        title: input.title,
        description: input.description,
        budgetSol: input.budgetSol,
        deadline: input.deadline ? Timestamp.fromMillis(input.deadline) : null,
        requirements: input.requirements,
        category: input.category,
        status: 'open' satisfies GigStatus,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function getGig(gigId: string): Promise<Gig | null> {
    const snap = await getDoc(doc(db, COLLECTION, gigId));
    if (!snap.exists()) return null;
    return fromDoc(snap.id, snap.data());
}

export async function listOpenGigs(opts?: { category?: string; limit?: number }): Promise<Gig[]> {
    const constraints = [where('status', '==', 'open' satisfies GigStatus)];
    if (opts?.category) constraints.push(where('category', '==', opts.category));
    const q = query(
        collection(db, COLLECTION),
        ...constraints,
        orderBy('createdAt', 'desc'),
        fsLimit(opts?.limit ?? 50),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function listGigsByBrand(brandId: string): Promise<Gig[]> {
    const q = query(
        collection(db, COLLECTION),
        where('brandId', '==', brandId),
        orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function updateGigStatus(gigId: string, status: GigStatus): Promise<void> {
    await updateDoc(doc(db, COLLECTION, gigId), { status });
}

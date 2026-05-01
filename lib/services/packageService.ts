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
import type { PackageListing, PackageStatus } from '@/types/marketplace';

const COLLECTION = 'packages';

function fromDoc(id: string, data: any): PackageListing {
    return {
        id,
        sellerId: data.sellerId,
        title: data.title,
        description: data.description,
        priceSol: data.priceSol,
        deliverables: data.deliverables ?? [],
        mediaUrls: data.mediaUrls ?? [],
        category: data.category ?? 'general',
        status: data.status as PackageStatus,
        createdAt: (data.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
    };
}

export interface CreatePackageInput {
    title: string;
    description: string;
    priceSol: number;
    deliverables: string[];
    mediaUrls: string[];
    category: string;
}

export async function createPackage(input: CreatePackageInput): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const ref = await addDoc(collection(db, COLLECTION), {
        sellerId: uid,
        ...input,
        status: 'active' satisfies PackageStatus,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function getPackage(packageId: string): Promise<PackageListing | null> {
    const snap = await getDoc(doc(db, COLLECTION, packageId));
    if (!snap.exists()) return null;
    return fromDoc(snap.id, snap.data());
}

export async function listActivePackages(opts?: { category?: string; limit?: number }): Promise<PackageListing[]> {
    const constraints = [where('status', '==', 'active' satisfies PackageStatus)];
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

export async function listPackagesBySeller(sellerId: string): Promise<PackageListing[]> {
    const q = query(
        collection(db, COLLECTION),
        where('sellerId', '==', sellerId),
        orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function updatePackageStatus(packageId: string, status: PackageStatus): Promise<void> {
    await updateDoc(doc(db, COLLECTION, packageId), { status });
}

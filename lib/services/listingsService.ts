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
    startAfter,
    updateDoc,
    where,
    type DocumentSnapshot,
    type QueryConstraint,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import type {
    Gig,
    GigStatus,
    Listing,
    ListingCategory,
    ListingKind,
    ListingSort,
    Service,
    ServiceStatus,
} from '@/lib/types/listing';
import { tsMs } from '@/lib/utils/firestoreTimestamp';

// IMPORTANT: collection names + required fields must stay in lockstep with
// the `match /services/{serviceId}` and `match /gigs/{gigId}` blocks in
// adler-app/firestore.rules. Any divergence triggers
// "Missing or insufficient permissions" at write time.
const SERVICES = 'services';
const GIGS = 'gigs';

const PUBLIC_STATUS: Record<ListingKind, ServiceStatus | GigStatus> = {
    service: 'active',
    gig: 'open',
};

const OWNER_FIELD: Record<ListingKind, 'sellerId' | 'brandId'> = {
    service: 'sellerId',
    gig: 'brandId',
};

function readMediaUrls(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string');
}

function readService(id: string, data: Record<string, unknown>): Service {
    return {
        kind: 'service',
        id,
        sellerId: (data.sellerId as string) ?? '',
        title: (data.title as string) ?? '',
        description: (data.description as string) ?? '',
        category: ((data.category as ListingCategory) ?? 'general') as ListingCategory,
        priceSol: (data.priceSol as number) ?? 0,
        status: ((data.status as ServiceStatus) ?? 'active') as ServiceStatus,
        ownerHandle: (data.sellerHandle as string | undefined) ?? null,
        ownerDisplayName: (data.sellerDisplayName as string | undefined) ?? null,
        ownerAvatarUrl: (data.sellerAvatarUrl as string | undefined) ?? null,
        mediaUrls: readMediaUrls(data.mediaUrls),
        createdAt: tsMs(data.createdAt),
        updatedAt: tsMs(data.updatedAt),
    };
}

function readGig(id: string, data: Record<string, unknown>): Gig {
    return {
        kind: 'gig',
        id,
        brandId: (data.brandId as string) ?? '',
        title: (data.title as string) ?? '',
        description: (data.description as string) ?? '',
        category: ((data.category as ListingCategory) ?? 'general') as ListingCategory,
        budgetSol: (data.budgetSol as number) ?? 0,
        requirements: (data.requirements as string) ?? '',
        status: ((data.status as GigStatus) ?? 'open') as GigStatus,
        ownerHandle: (data.brandHandle as string | undefined) ?? null,
        ownerDisplayName: (data.brandDisplayName as string | undefined) ?? null,
        ownerAvatarUrl: (data.brandAvatarUrl as string | undefined) ?? null,
        mediaUrls: readMediaUrls(data.mediaUrls),
        createdAt: tsMs(data.createdAt),
        updatedAt: tsMs(data.updatedAt),
    };
}

function snapToListing(
    kind: ListingKind,
    id: string,
    data: Record<string, unknown>,
): Listing {
    return kind === 'service' ? readService(id, data) : readGig(id, data);
}

function collectionNameFor(kind: ListingKind): string {
    return kind === 'service' ? SERVICES : GIGS;
}

export interface ListListingsOptions {
    kind: ListingKind;
    category?: ListingCategory | null;
    cursor?: DocumentSnapshot | null;
    pageSize?: number;
}

export interface ListListingsResult {
    items: Listing[];
    nextCursor: DocumentSnapshot | null;
}

export async function listListings({
    kind,
    category,
    cursor,
    pageSize = 20,
}: ListListingsOptions): Promise<ListListingsResult> {
    const constraints: QueryConstraint[] = [
        where('status', '==', PUBLIC_STATUS[kind]),
    ];
    if (category) {
        constraints.push(where('category', '==', category));
    }
    constraints.push(orderBy('createdAt', 'desc'));
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(fsLimit(pageSize));

    const ref = collection(db, collectionNameFor(kind));
    const snap = await getDocs(query(ref, ...constraints));

    const items = snap.docs.map((d) =>
        snapToListing(kind, d.id, d.data() as Record<string, unknown>),
    );
    const nextCursor =
        snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;

    return { items, nextCursor };
}

export async function listMyListings(
    kind: ListingKind,
    uid: string,
): Promise<Listing[]> {
    const ref = collection(db, collectionNameFor(kind));
    const snap = await getDocs(
        query(
            ref,
            where(OWNER_FIELD[kind], '==', uid),
            orderBy('createdAt', 'desc'),
        ),
    );
    return snap.docs.map((d) =>
        snapToListing(kind, d.id, d.data() as Record<string, unknown>),
    );
}

export async function getListing(
    kind: ListingKind,
    id: string,
): Promise<Listing | null> {
    const snap = await getDoc(doc(db, collectionNameFor(kind), id));
    if (!snap.exists()) return null;
    return snapToListing(kind, snap.id, snap.data() as Record<string, unknown>);
}

export interface CreateServiceInput {
    title: string;
    description: string;
    category: ListingCategory;
    priceSol: number;
    ownerHandle: string;
    ownerDisplayName: string;
    ownerAvatarUrl: string | null;
    mediaUrls?: string[];
}

export interface CreateGigInput {
    title: string;
    description: string;
    category: ListingCategory;
    budgetSol: number;
    requirements: string;
    ownerHandle: string;
    ownerDisplayName: string;
    ownerAvatarUrl: string | null;
    mediaUrls?: string[];
}

export async function createService(
    input: CreateServiceInput,
): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const ref = await addDoc(collection(db, SERVICES), {
        sellerId: uid,
        status: 'active' satisfies ServiceStatus,
        title: input.title,
        description: input.description,
        category: input.category,
        priceSol: input.priceSol,
        sellerHandle: input.ownerHandle,
        sellerDisplayName: input.ownerDisplayName,
        sellerAvatarUrl: input.ownerAvatarUrl,
        mediaUrls: input.mediaUrls ?? [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function createGig(input: CreateGigInput): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const ref = await addDoc(collection(db, GIGS), {
        brandId: uid,
        status: 'open' satisfies GigStatus,
        title: input.title,
        description: input.description,
        category: input.category,
        budgetSol: input.budgetSol,
        requirements: input.requirements,
        brandHandle: input.ownerHandle,
        brandDisplayName: input.ownerDisplayName,
        brandAvatarUrl: input.ownerAvatarUrl,
        mediaUrls: input.mediaUrls ?? [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export interface UpdateServicePatch {
    title?: string;
    description?: string;
    category?: ListingCategory;
    priceSol?: number;
    status?: ServiceStatus;
    mediaUrls?: string[];
}

export interface UpdateGigPatch {
    title?: string;
    description?: string;
    category?: ListingCategory;
    budgetSol?: number;
    requirements?: string;
    status?: GigStatus;
    mediaUrls?: string[];
}

export async function updateService(
    id: string,
    patch: UpdateServicePatch,
): Promise<void> {
    await updateDoc(doc(db, SERVICES, id), {
        ...patch,
        updatedAt: serverTimestamp(),
    });
}

export async function updateGig(
    id: string,
    patch: UpdateGigPatch,
): Promise<void> {
    await updateDoc(doc(db, GIGS, id), {
        ...patch,
        updatedAt: serverTimestamp(),
    });
}

// Hard delete is forbidden by the rules. "Delete from the dashboard" is a
// status flip — services → 'paused' (or 'sold' once a contract closes);
// gigs → 'closed'. Doc still exists and is owner-readable for history.
export async function archiveService(id: string): Promise<void> {
    await updateService(id, { status: 'paused' });
}

export async function archiveGig(id: string): Promise<void> {
    await updateGig(id, { status: 'closed' });
}

function priceFor(listing: Listing): number {
    return listing.kind === 'service' ? listing.priceSol : listing.budgetSol;
}

/**
 * Case-insensitive substring filter across the user-facing listing fields
 * and the denormalized owner snapshot. Empty/whitespace `query` is a
 * passthrough — same identity as the unfiltered list. Pure; cheap to call
 * on every keystroke at the page sizes browse pulls.
 */
export function applyListingFilter(
    listings: Listing[],
    queryStr: string,
): Listing[] {
    const q = queryStr.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((listing) => {
        const haystack = [
            listing.title,
            listing.description,
            listing.ownerHandle ?? '',
            listing.ownerDisplayName ?? '',
        ]
            .join(' ')
            .toLowerCase();
        return haystack.includes(q);
    });
}

/**
 * Pure sort helper. Returns a new array — never mutates the caller's
 * list. Service price reads from `priceSol`; gig price reads from
 * `budgetSol`; both share the "Price" UX label.
 */
export function applyListingSort(
    listings: Listing[],
    sort: ListingSort,
): Listing[] {
    const next = [...listings];
    switch (sort) {
        case 'newest':
            next.sort((a, b) => b.createdAt - a.createdAt);
            return next;
        case 'oldest':
            next.sort((a, b) => a.createdAt - b.createdAt);
            return next;
        case 'price_low':
            next.sort((a, b) => priceFor(a) - priceFor(b));
            return next;
        case 'price_high':
            next.sort((a, b) => priceFor(b) - priceFor(a));
            return next;
    }
}

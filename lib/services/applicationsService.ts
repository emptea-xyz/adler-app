import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    writeBatch,
    where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import type {
    ApplicationStatus,
    GigApplication,
} from '@/lib/types/application';
import { tsMs } from '@/lib/utils/firestoreTimestamp';

// Source of truth for the gigApplications collection: the
// `match /gigApplications/{applicationId}` block in adler-app/firestore.rules.
const COLLECTION = 'gigApplications';

/**
 * Doc id is deterministic so each (gig, creator) pair has at most one
 * application doc. The rule pins create to the same shape, which means two
 * parallel apply attempts can't race past each other — the second write
 * hits the existing doc and falls under update rules (brand-only).
 */
export function applicationIdFor(gigId: string, creatorId: string): string {
    return `${gigId}_${creatorId}`;
}

function rowToApplication(
    id: string,
    data: Record<string, unknown>,
): GigApplication {
    const sampleUrls = Array.isArray(data.sampleUrls)
        ? (data.sampleUrls as string[])
        : [];
    return {
        id,
        gigId: (data.gigId as string) ?? '',
        creatorId: (data.creatorId as string) ?? '',
        status: ((data.status as ApplicationStatus) ?? 'pending') as ApplicationStatus,
        message: (data.message as string) ?? '',
        sampleUrls,
        gigTitle: (data.gigTitle as string | undefined) ?? null,
        brandId: (data.brandId as string | undefined) ?? null,
        brandHandle: (data.brandHandle as string | undefined) ?? null,
        brandDisplayName: (data.brandDisplayName as string | undefined) ?? null,
        creatorHandle: (data.creatorHandle as string | undefined) ?? null,
        creatorDisplayName:
            (data.creatorDisplayName as string | undefined) ?? null,
        creatorAvatarUrl: (data.creatorAvatarUrl as string | undefined) ?? null,
        createdAt: tsMs(data.createdAt),
        updatedAt: tsMs(data.updatedAt),
    };
}

export async function listApplicationsByCreator(
    uid: string,
): Promise<GigApplication[]> {
    const snap = await getDocs(
        query(
            collection(db, COLLECTION),
            where('creatorId', '==', uid),
            orderBy('createdAt', 'desc'),
        ),
    );
    return snap.docs.map((d) =>
        rowToApplication(d.id, d.data() as Record<string, unknown>),
    );
}

export async function listApplicationsByBrand(
    uid: string,
): Promise<GigApplication[]> {
    const snap = await getDocs(
        query(
            collection(db, COLLECTION),
            where('brandId', '==', uid),
            orderBy('createdAt', 'desc'),
        ),
    );
    return snap.docs.map((d) =>
        rowToApplication(d.id, d.data() as Record<string, unknown>),
    );
}

export async function listApplicationsForGig(
    gigId: string,
): Promise<GigApplication[]> {
    const snap = await getDocs(
        query(
            collection(db, COLLECTION),
            where('gigId', '==', gigId),
            orderBy('createdAt', 'desc'),
        ),
    );
    return snap.docs.map((d) =>
        rowToApplication(d.id, d.data() as Record<string, unknown>),
    );
}

export async function getApplication(
    applicationId: string,
): Promise<GigApplication | null> {
    const snap = await getDoc(doc(db, COLLECTION, applicationId));
    if (!snap.exists()) return null;
    return rowToApplication(snap.id, snap.data() as Record<string, unknown>);
}

export async function hasCreatorAppliedToGig(
    creatorId: string,
    gigId: string,
): Promise<boolean> {
    // Single-doc lookup against the deterministic id — no list query, no
    // composite index needed.
    const snap = await getDoc(
        doc(db, COLLECTION, applicationIdFor(gigId, creatorId)),
    );
    return snap.exists();
}

export interface CreateApplicationInput {
    gigId: string;
    /** brandId is required by the rule (verified against the parent gig). */
    brandId: string;
    message: string;
    sampleUrls?: string[];
    // Denormalized snapshots — best-effort at create time so the brand's
    // /applicants dashboard renders without an extra profile/gig read per row.
    gigTitle?: string | null;
    brandHandle?: string | null;
    brandDisplayName?: string | null;
    creatorHandle?: string | null;
    creatorDisplayName?: string | null;
    creatorAvatarUrl?: string | null;
}

export async function createApplication(
    input: CreateApplicationInput,
): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const id = applicationIdFor(input.gigId, uid);
    const existing = await getDoc(doc(db, COLLECTION, id));
    if (existing.exists()) {
        throw new Error('You have already applied to this gig');
    }
    // setDoc against a deterministic id. If a doc already exists it falls
    // under update rules (brand-only) and the rule rejects it — that's the
    // anti-double-apply guarantee.
    await setDoc(doc(db, COLLECTION, id), {
        creatorId: uid,
        gigId: input.gigId,
        brandId: input.brandId,
        status: 'pending' satisfies ApplicationStatus,
        message: input.message,
        sampleUrls: input.sampleUrls ?? [],
        gigTitle: input.gigTitle ?? null,
        brandHandle: input.brandHandle ?? null,
        brandDisplayName: input.brandDisplayName ?? null,
        creatorHandle: input.creatorHandle ?? null,
        creatorDisplayName: input.creatorDisplayName ?? null,
        creatorAvatarUrl: input.creatorAvatarUrl ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return id;
}

export async function setApplicationStatus(
    id: string,
    status: ApplicationStatus,
): Promise<void> {
    if (status === 'pending') {
        throw new Error('Cannot revert an application to pending');
    }
    await updateDoc(doc(db, COLLECTION, id), {
        status,
        updatedAt: serverTimestamp(),
    });
}

interface AwardApplicationInput {
    gigId: string;
    applicationId: string;
}

export async function awardApplicationAndCloseGig({
    gigId,
    applicationId,
}: AwardApplicationInput): Promise<void> {
    const snap = await getDocs(
        query(collection(db, COLLECTION), where('gigId', '==', gigId)),
    );
    if (snap.empty) throw new Error('No applications found for this gig');

    const winner = snap.docs.find((row) => row.id === applicationId);
    if (!winner) throw new Error('Application not found');

    const batch = writeBatch(db);

    snap.docs.forEach((row) => {
        const data = row.data() as Record<string, unknown>;
        const current = ((data.status as ApplicationStatus | undefined) ??
            'pending') as ApplicationStatus;
        const next: ApplicationStatus = row.id === applicationId ? 'awarded' : 'rejected';

        if (current !== next) {
            batch.update(doc(db, COLLECTION, row.id), {
                status: next,
                updatedAt: serverTimestamp(),
            });
        }
    });

    batch.update(doc(db, 'gigs', gigId), {
        status: 'awarded',
        updatedAt: serverTimestamp(),
    });

    await batch.commit();
}

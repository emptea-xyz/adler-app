import {
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { tsMs } from '@/lib/utils/firestoreTimestamp';
import {
    uploadBountySubmissionPhoto,
    uploadBountySubmissionVideo,
} from '@/lib/services/bountyMediaUploadService';
import { getBounty } from '@/lib/services/bountyService';
import type { Submission } from '@/lib/types/submission';
import type { Bounty } from '@/lib/types/bounty';

const SUBMISSIONS = 'submissions';

function rowToSubmission(id: string, data: Record<string, unknown>): Submission {
    return {
        id,
        bountyId: (data.bountyId as string) ?? '',
        submitterId: (data.submitterId as string) ?? '',
        photoUrl: (data.photoUrl as string) ?? '',
        photoStoragePath: (data.photoStoragePath as string) ?? '',
        videoUrl: (data.videoUrl as string) ?? '',
        videoStoragePath: (data.videoStoragePath as string) ?? '',
        linkUrl: (data.linkUrl as string | null) || null,
        submittedAt: tsMs(data.submittedAt) || Date.now(),
        isWinner: data.isWinner === true,
        bountyTitle: (data.bountyTitle as string | undefined) ?? undefined,
        bountyLamports:
            typeof data.bountyLamports === 'number' ? data.bountyLamports : undefined,
        bountyStatus: (data.bountyStatus as Submission['bountyStatus']) ?? undefined,
        bountyPosterId: (data.bountyPosterId as string | undefined) ?? undefined,
        bountySubmissionKind:
            (data.bountySubmissionKind as Submission['bountySubmissionKind']) ?? undefined,
        bountyScope: (data.bountyScope as Submission['bountyScope']) ?? undefined,
        bountyGroupId: (data.bountyGroupId as string | null | undefined) ?? undefined,
    };
}

function bountyPreviewFields(bounty: Bounty): Pick<
    Submission,
    | 'bountyTitle'
    | 'bountyLamports'
    | 'bountyStatus'
    | 'bountyPosterId'
    | 'bountySubmissionKind'
    | 'bountyScope'
    | 'bountyGroupId'
> {
    return {
        bountyTitle: bounty.title,
        bountyLamports: bounty.bountyLamports,
        bountyStatus: bounty.status,
        bountyPosterId: bounty.posterId,
        bountySubmissionKind: bounty.submissionKind,
        bountyScope: bounty.scope,
        bountyGroupId: bounty.groupId,
    };
}

async function requireSubmittableBounty(bountyId: string): Promise<Bounty> {
    const bounty = await getBounty(bountyId);
    if (!bounty) throw new Error('Bounty not found');
    if (bounty.status !== 'open') throw new Error('This bounty is no longer accepting submissions.');
    if (!bounty.escrowFunded) throw new Error('This bounty is not funded yet.');
    if (bounty.submissionEndsAt <= Date.now()) {
        throw new Error('The submission window for this bounty has ended.');
    }
    return bounty;
}

export interface CreateSubmissionInput {
    bountyId: string;
    photoUri: string;
}

/**
 * Upload a photo, then write the submission doc. Reviewed manually by
 * the bounty poster.
 */
export async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    const bounty = await requireSubmittableBounty(input.bountyId);
    const { url, path } = await uploadBountySubmissionPhoto(input.photoUri);
    const id = `${input.bountyId}_${uid}`;
    const ref = doc(db, SUBMISSIONS, id);
    const payload = {
        bountyId: input.bountyId,
        submitterId: uid,
        photoUrl: url,
        photoStoragePath: path,
        videoUrl: '',
        videoStoragePath: '',
        linkUrl: '',
        submittedAt: serverTimestamp(),
        isWinner: false,
        ...bountyPreviewFields(bounty),
    };
    await setDoc(ref, payload);
    return {
        id,
        bountyId: input.bountyId,
        submitterId: uid,
        photoUrl: url,
        photoStoragePath: path,
        videoUrl: '',
        videoStoragePath: '',
        linkUrl: null,
        submittedAt: Date.now(),
        isWinner: false,
        ...bountyPreviewFields(bounty),
    };
}

export interface CreateVideoSubmissionInput {
    bountyId: string;
    videoUri: string;
    mimeType?: string;
}

/**
 * Upload a video, then write the submission doc. Reviewed manually by
 * the bounty poster.
 */
export async function createVideoSubmission(
    input: CreateVideoSubmissionInput,
): Promise<Submission> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    const bounty = await requireSubmittableBounty(input.bountyId);
    const { url, path } = await uploadBountySubmissionVideo(input.videoUri, input.mimeType);
    const id = `${input.bountyId}_${uid}`;
    const ref = doc(db, SUBMISSIONS, id);
    const payload = {
        bountyId: input.bountyId,
        submitterId: uid,
        photoUrl: '',
        photoStoragePath: '',
        videoUrl: url,
        videoStoragePath: path,
        linkUrl: '',
        submittedAt: serverTimestamp(),
        isWinner: false,
        ...bountyPreviewFields(bounty),
    };
    await setDoc(ref, payload);
    return {
        id,
        bountyId: input.bountyId,
        submitterId: uid,
        photoUrl: '',
        photoStoragePath: '',
        videoUrl: url,
        videoStoragePath: path,
        linkUrl: null,
        submittedAt: Date.now(),
        isWinner: false,
        ...bountyPreviewFields(bounty),
    };
}

/** Submit a link-style entry (no upload, e.g. a GitHub repo URL). */
export async function createLinkSubmission(input: {
    bountyId: string;
    linkUrl: string;
}): Promise<Submission> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    const bounty = await requireSubmittableBounty(input.bountyId);
    // L19 / M4: mirror the rule check so non-UI callers get a clean
    // client-side error instead of an opaque permission-denied.
    const trimmedLink = input.linkUrl.trim();
    if (!/^https?:\/\/.+/.test(trimmedLink)) {
        throw new Error('Link must start with http:// or https://');
    }
    if (trimmedLink.length > 2048) {
        throw new Error('Link is too long (max 2048 chars).');
    }
    const id = `${input.bountyId}_${uid}`;
    const ref = doc(db, SUBMISSIONS, id);
    const payload = {
        bountyId: input.bountyId,
        submitterId: uid,
        photoUrl: '',
        photoStoragePath: '',
        videoUrl: '',
        videoStoragePath: '',
        linkUrl: trimmedLink,
        submittedAt: serverTimestamp(),
        isWinner: false,
        ...bountyPreviewFields(bounty),
    };
    await setDoc(ref, payload);
    return {
        id,
        bountyId: input.bountyId,
        submitterId: uid,
        photoUrl: '',
        photoStoragePath: '',
        videoUrl: '',
        videoStoragePath: '',
        linkUrl: trimmedLink,
        submittedAt: Date.now(),
        isWinner: false,
        ...bountyPreviewFields(bounty),
    };
}

export async function listSubmissionsForBounty(
    bountyId: string,
    max = 100,
): Promise<Submission[]> {
    const snap = await getDocs(
        query(
            collection(db, SUBMISSIONS),
            where('bountyId', '==', bountyId),
            orderBy('submittedAt', 'asc'),
            limit(max),
        ),
    );
    return snap.docs.map((d) => rowToSubmission(d.id, d.data() as Record<string, unknown>));
}

export async function listMySubmissions(uid: string, max = 100): Promise<Submission[]> {
    const snap = await getDocs(
        query(
            collection(db, SUBMISSIONS),
            where('submitterId', '==', uid),
            orderBy('submittedAt', 'desc'),
            limit(max),
        ),
    );
    return snap.docs.map((d) => rowToSubmission(d.id, d.data() as Record<string, unknown>));
}

export async function listMySubmissionsForBounty(
    bountyId: string,
    uid: string,
): Promise<Submission[]> {
    const snap = await getDocs(
        query(
            collection(db, SUBMISSIONS),
            where('bountyId', '==', bountyId),
            where('submitterId', '==', uid),
        ),
    );
    return snap.docs.map((d) => rowToSubmission(d.id, d.data() as Record<string, unknown>));
}

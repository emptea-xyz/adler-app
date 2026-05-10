import {
    addDoc,
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { tsMs } from '@/lib/utils/firestoreTimestamp';
import { uploadBountySubmissionPhoto } from '@/lib/services/bountyMediaUploadService';
import type { AiVerdict, Submission } from '@/lib/types/submission';

const SUBMISSIONS = 'submissions';

function rowToSubmission(id: string, data: Record<string, unknown>): Submission {
    return {
        id,
        bountyId: (data.bountyId as string) ?? '',
        submitterId: (data.submitterId as string) ?? '',
        photoUrl: (data.photoUrl as string) ?? '',
        photoStoragePath: (data.photoStoragePath as string) ?? '',
        submittedAt: tsMs(data.submittedAt) || Date.now(),
        aiVerdict: (data.aiVerdict as AiVerdict | null) ?? null,
        aiConfidence: typeof data.aiConfidence === 'number' ? data.aiConfidence : null,
        aiReasoning: (data.aiReasoning as string | null) ?? null,
        isWinner: data.isWinner === true,
    };
}

export interface CreateSubmissionInput {
    bountyId: string;
    photoUri: string;
}

/**
 * Upload the photo to Firebase Storage, then write the submission doc.
 * Cloud Function `verifyBountySubmission` picks it up, runs Gemini, and
 * (auto mode) lands the on-chain settle if it passes.
 */
export async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    const { url, path } = await uploadBountySubmissionPhoto(input.photoUri);
    const ref = await addDoc(collection(db, SUBMISSIONS), {
        bountyId: input.bountyId,
        submitterId: uid,
        photoUrl: url,
        photoStoragePath: path,
        submittedAt: serverTimestamp(),
        aiVerdict: null,
        aiConfidence: null,
        aiReasoning: null,
        isWinner: false,
    });
    return {
        id: ref.id,
        bountyId: input.bountyId,
        submitterId: uid,
        photoUrl: url,
        photoStoragePath: path,
        submittedAt: Date.now(),
        aiVerdict: null,
        aiConfidence: null,
        aiReasoning: null,
        isWinner: false,
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

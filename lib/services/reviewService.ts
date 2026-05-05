import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    where,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import type { Review } from '@/types/marketplace';

const COLLECTION = 'reviews';

function fromDoc(id: string, data: any): Review {
    return {
        id,
        orderId: data.orderId,
        reviewerId: data.reviewerId,
        revieweeId: data.revieweeId,
        rating: data.rating,
        comment: data.comment ?? '',
        createdAt: (data.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
    };
}

export interface SubmitReviewInput {
    orderId: string;
    revieweeId: string;
    rating: number;
    comment: string;
}

/**
 * Deterministic doc id (`${orderId}_${reviewerId}`) — prevents the same
 * reviewer from posting twice on the same order. The Firestore rule mirrors
 * this so a tampered client can't bypass it.
 */
export async function submitReview(input: SubmitReviewInput): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    if (uid === input.revieweeId) {
        throw new Error('Cannot review yourself');
    }
    if (input.rating < 1 || input.rating > 5) {
        throw new Error('Rating must be 1–5');
    }
    const reviewId = `${input.orderId}_${uid}`;
    await setDoc(doc(db, COLLECTION, reviewId), {
        orderId: input.orderId,
        reviewerId: uid,
        revieweeId: input.revieweeId,
        rating: input.rating,
        comment: input.comment,
        createdAt: serverTimestamp(),
    });
}

export async function listReviewsForOrder(orderId: string): Promise<Review[]> {
    const q = query(collection(db, COLLECTION), where('orderId', '==', orderId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function listReviewsByReviewee(revieweeId: string): Promise<Review[]> {
    const q = query(collection(db, COLLECTION), where('revieweeId', '==', revieweeId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

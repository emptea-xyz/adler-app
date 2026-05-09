import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { getOrder } from '@/lib/services/ordersService';
import {
    RATING_AXES,
    type RatingAxes,
    type RatingAxis,
    type Review,
} from '@/lib/types/review';
import { tsMs } from '@/lib/utils/firestoreTimestamp';

// Source of truth for the schema: the `match /reviews/{reviewId}` block in
// adler-app/firestore.rules. Doc id is deterministic per the rule, which
// gives at-most-one review per (order, reviewer) pair without extra query
// gymnastics.
const COLLECTION = 'reviews';

export function reviewIdFor(orderId: string, reviewerId: string): string {
    return `${orderId}_${reviewerId}`;
}

function readAxes(value: unknown): RatingAxes {
    const out: RatingAxes = {
        scope: 0,
        communication: 0,
        timeliness: 0,
        quality: 0,
    };
    if (!value || typeof value !== 'object') return out;
    const row = value as Record<string, unknown>;
    for (const axis of RATING_AXES) {
        const n = row[axis];
        out[axis] = typeof n === 'number' ? n : 0;
    }
    return out;
}

function rowToReview(id: string, data: Record<string, unknown>): Review {
    return {
        id,
        orderId: (data.orderId as string) ?? '',
        reviewerId: (data.reviewerId as string) ?? '',
        revieweeId: (data.revieweeId as string) ?? '',
        axes: readAxes(data.axes),
        comment: (data.comment as string) ?? '',
        amountSol: (data.amountSol as number) ?? 0,
        listingId: (data.listingId as string) ?? '',
        createdAt: tsMs(data.createdAt),
    };
}

export interface SubmitReviewInput {
    orderId: string;
    revieweeId: string;
    axes: RatingAxes;
    comment?: string;
}

/**
 * Submit (or edit) the caller's review for `orderId`. Pulls amountSol +
 * listingId from the parent order at write time so the rule can pin both
 * fields and aggregates need no join.
 */
export async function submitReview(input: SubmitReviewInput): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    if (uid === input.revieweeId) {
        throw new Error('Cannot review yourself');
    }
    const order = await getOrder(input.orderId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'complete') {
        throw new Error('Order must be complete before rating');
    }
    if (uid !== order.buyerId && uid !== order.sellerId) {
        throw new Error('Only order participants can rate');
    }

    const reviewId = reviewIdFor(input.orderId, uid);
    const ref = doc(db, COLLECTION, reviewId);
    const existing = await getDoc(ref);

    if (existing.exists()) {
        // Edit path — the rule restricts to axes + comment.
        await setDoc(
            ref,
            {
                axes: input.axes,
                comment: input.comment ?? '',
            },
            { merge: true },
        );
        return reviewId;
    }

    await setDoc(ref, {
        orderId: input.orderId,
        reviewerId: uid,
        revieweeId: input.revieweeId,
        axes: input.axes,
        comment: input.comment ?? '',
        amountSol: order.amountSol,
        listingId: order.listingId,
        createdAt: serverTimestamp(),
    });
    return reviewId;
}

export async function getReviewByReviewer(
    orderId: string,
    reviewerId: string,
): Promise<Review | null> {
    const snap = await getDoc(
        doc(db, COLLECTION, reviewIdFor(orderId, reviewerId)),
    );
    if (!snap.exists()) return null;
    return rowToReview(snap.id, snap.data() as Record<string, unknown>);
}

export async function listReviewsByReviewee(uid: string): Promise<Review[]> {
    const snap = await getDocs(
        query(
            collection(db, COLLECTION),
            where('revieweeId', '==', uid),
            orderBy('createdAt', 'desc'),
        ),
    );
    return snap.docs.map((d) =>
        rowToReview(d.id, d.data() as Record<string, unknown>),
    );
}

export async function listReviewsByListing(
    listingId: string,
): Promise<Review[]> {
    const snap = await getDocs(
        query(
            collection(db, COLLECTION),
            where('listingId', '==', listingId),
            orderBy('createdAt', 'desc'),
        ),
    );
    return snap.docs.map((d) =>
        rowToReview(d.id, d.data() as Record<string, unknown>),
    );
}

export async function listReviewsForOrder(
    orderId: string,
): Promise<Review[]> {
    const snap = await getDocs(
        query(collection(db, COLLECTION), where('orderId', '==', orderId)),
    );
    return snap.docs.map((d) =>
        rowToReview(d.id, d.data() as Record<string, unknown>),
    );
}

export interface ReviewAggregate {
    count: number;
    totalSol: number;
    /** Deal-size-weighted overall score across all four axes. NaN when count is 0. */
    overall: number;
    /** Deal-size-weighted score per axis. NaN entries when count is 0. */
    perAxis: RatingAxes;
}

function meanOfAxes(axes: RatingAxes): number {
    return (
        (axes.scope + axes.communication + axes.timeliness + axes.quality) / 4
    );
}

/**
 * Pure aggregator. Σ(rating × amountSol) / Σ(amountSol). Falls back to a
 * simple mean if every review has amountSol = 0 (shouldn't happen with the
 * rule pinning amountSol > 0, but cheap defence).
 */
export function aggregate(reviews: Review[]): ReviewAggregate {
    const empty: ReviewAggregate = {
        count: 0,
        totalSol: 0,
        overall: NaN,
        perAxis: { scope: NaN, communication: NaN, timeliness: NaN, quality: NaN },
    };
    if (reviews.length === 0) return empty;

    let totalWeight = 0;
    let weightedOverall = 0;
    const weightedPerAxis: Record<RatingAxis, number> = {
        scope: 0,
        communication: 0,
        timeliness: 0,
        quality: 0,
    };

    for (const r of reviews) {
        const w = r.amountSol > 0 ? r.amountSol : 1;
        totalWeight += w;
        weightedOverall += meanOfAxes(r.axes) * w;
        for (const axis of RATING_AXES) {
            weightedPerAxis[axis] += r.axes[axis] * w;
        }
    }

    const overall = weightedOverall / totalWeight;
    const perAxis: RatingAxes = {
        scope: weightedPerAxis.scope / totalWeight,
        communication: weightedPerAxis.communication / totalWeight,
        timeliness: weightedPerAxis.timeliness / totalWeight,
        quality: weightedPerAxis.quality / totalWeight,
    };
    const totalSol = reviews.reduce((sum, r) => sum + (r.amountSol ?? 0), 0);

    return { count: reviews.length, totalSol, overall, perAxis };
}

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
    where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { getOrder } from '@/lib/services/ordersService';
import type {
    Dispute,
    DisputeOutcome,
    DisputeStatus,
} from '@/lib/types/dispute';
import { OUTCOME_NOTE_MAX, REASON_MAX } from '@/lib/types/dispute';
import { tsMs } from '@/lib/utils/firestoreTimestamp';

const DISPUTES = 'disputes';

function rowToDispute(id: string, data: Record<string, unknown>): Dispute {
    return {
        id,
        orderId: (data.orderId as string) ?? '',
        buyerId: (data.buyerId as string) ?? '',
        sellerId: (data.sellerId as string) ?? '',
        listingId: (data.listingId as string) ?? '',
        threadId: (data.threadId as string) ?? `order_${(data.orderId as string) ?? ''}`,
        filedBy: data.filedBy === 'seller' ? 'seller' : 'buyer',
        reason: (data.reason as string) ?? '',
        status: ((data.status as DisputeStatus | undefined) ?? 'open') as DisputeStatus,
        outcome: ((data.outcome as DisputeOutcome | null | undefined) ??
            null) as DisputeOutcome | null,
        outcomeNote: (data.outcomeNote as string) ?? '',
        splitPercentToCreator:
            typeof data.splitPercentToCreator === 'number'
                ? data.splitPercentToCreator
                : null,
        resolvedBy: (data.resolvedBy as string | null | undefined) ?? null,
        resolvedAt: tsMs(data.resolvedAt),
        amountSol: (data.amountSol as number) ?? 0,
        createdAt: tsMs(data.createdAt),
        updatedAt: tsMs(data.updatedAt),
    };
}

export async function getDispute(disputeId: string): Promise<Dispute | null> {
    const snap = await getDoc(doc(db, DISPUTES, disputeId));
    if (!snap.exists()) return null;
    return rowToDispute(snap.id, snap.data() as Record<string, unknown>);
}

export async function getDisputeByOrder(
    orderId: string,
): Promise<Dispute | null> {
    return getDispute(orderId);
}

export interface FileDisputeInput {
    orderId: string;
    reason: string;
}

export async function fileDispute(input: FileDisputeInput): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const reason = input.reason.trim();
    if (!reason) throw new Error('Dispute reason is required');
    if (reason.length > REASON_MAX) {
        throw new Error(`Reason must be ${REASON_MAX} characters or less`);
    }

    const order = await getOrder(input.orderId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'paid' && order.status !== 'delivered') {
        throw new Error('Disputes can only be filed on paid or delivered orders');
    }
    if (uid !== order.buyerId && uid !== order.sellerId) {
        throw new Error('Only order participants can file disputes');
    }
    const filedBy = uid === order.buyerId ? 'buyer' : 'seller';

    const ref = doc(db, DISPUTES, input.orderId);
    await setDoc(ref, {
        orderId: order.id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        listingId: order.listingId,
        threadId: `order_${order.id}`,
        filedBy,
        reason,
        status: 'open' satisfies DisputeStatus,
        outcome: null,
        outcomeNote: '',
        splitPercentToCreator: null,
        resolvedBy: null,
        resolvedAt: null,
        amountSol: order.amountSol,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export interface ResolveDisputeInput {
    disputeId: string;
    outcome: DisputeOutcome;
    outcomeNote: string;
    splitPercentToCreator?: number;
}

export async function resolveDispute(
    input: ResolveDisputeInput,
): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const note = input.outcomeNote.trim();
    if (note.length > OUTCOME_NOTE_MAX) {
        throw new Error(`Outcome note must be ${OUTCOME_NOTE_MAX} characters or less`);
    }
    if (input.outcome === 'split') {
        const pct = input.splitPercentToCreator;
        if (!Number.isFinite(pct) || pct! < 0 || pct! > 100) {
            throw new Error('Split outcome requires a percentage between 0 and 100');
        }
    }

    await updateDoc(doc(db, DISPUTES, input.disputeId), {
        status: 'resolved' satisfies DisputeStatus,
        outcome: input.outcome,
        outcomeNote: note,
        splitPercentToCreator: input.outcome === 'split'
            ? Math.round((input.splitPercentToCreator ?? 50) * 100) / 100
            : null,
        resolvedBy: uid,
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

export async function listOpenDisputes(): Promise<Dispute[]> {
    const snap = await getDocs(
        query(
            collection(db, DISPUTES),
            where('status', '==', 'open'),
            orderBy('createdAt', 'desc'),
        ),
    );
    return snap.docs.map((row) =>
        rowToDispute(row.id, row.data() as Record<string, unknown>),
    );
}

export async function listResolvedDisputes(): Promise<Dispute[]> {
    const snap = await getDocs(
        query(
            collection(db, DISPUTES),
            where('status', '==', 'resolved'),
            orderBy('createdAt', 'desc'),
        ),
    );
    return snap.docs.map((row) =>
        rowToDispute(row.id, row.data() as Record<string, unknown>),
    );
}

export async function listDisputesByParticipant(
    uid: string,
): Promise<Dispute[]> {
    const [buyerSnap, sellerSnap] = await Promise.all([
        getDocs(
            query(
                collection(db, DISPUTES),
                where('buyerId', '==', uid),
                orderBy('createdAt', 'desc'),
            ),
        ),
        getDocs(
            query(
                collection(db, DISPUTES),
                where('sellerId', '==', uid),
                orderBy('createdAt', 'desc'),
            ),
        ),
    ]);
    const map = new Map<string, Dispute>();
    for (const row of [...buyerSnap.docs, ...sellerSnap.docs]) {
        map.set(
            row.id,
            rowToDispute(row.id, row.data() as Record<string, unknown>),
        );
    }
    return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
}

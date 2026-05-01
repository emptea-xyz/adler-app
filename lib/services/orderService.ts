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
import type { Order, OrderStatus, OrderType } from '@/types/marketplace';

const COLLECTION = 'orders';

function fromDoc(id: string, data: any): Order {
    return {
        id,
        type: data.type as OrderType,
        referenceId: data.referenceId,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        amountSol: data.amountSol,
        txSignature: data.txSignature ?? null,
        status: data.status as OrderStatus,
        createdAt: (data.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
        updatedAt: (data.updatedAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
    };
}

export interface CreatePendingOrderInput {
    type: OrderType;
    referenceId: string;
    sellerId: string;
    amountSol: number;
}

/**
 * Create the order doc *before* sending the on-chain transfer so we have a
 * record of the buyer's intent even if the app crashes mid-transaction. The
 * txSignature is filled in once the transfer confirms.
 */
export async function createPendingOrder(input: CreatePendingOrderInput): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    if (uid === input.sellerId) throw new Error('Cannot buy from yourself');
    const ref = await addDoc(collection(db, COLLECTION), {
        type: input.type,
        referenceId: input.referenceId,
        buyerId: uid,
        sellerId: input.sellerId,
        amountSol: input.amountSol,
        txSignature: null,
        status: 'pending' satisfies OrderStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function markOrderPaid(orderId: string, txSignature: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, orderId), {
        txSignature,
        status: 'paid' satisfies OrderStatus,
        updatedAt: serverTimestamp(),
    });
}

export async function markOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await updateDoc(doc(db, COLLECTION, orderId), {
        status,
        updatedAt: serverTimestamp(),
    });
}

export async function getOrder(orderId: string): Promise<Order | null> {
    const snap = await getDoc(doc(db, COLLECTION, orderId));
    if (!snap.exists()) return null;
    return fromDoc(snap.id, snap.data());
}

export async function listOrdersByBuyer(buyerId: string): Promise<Order[]> {
    const q = query(
        collection(db, COLLECTION),
        where('buyerId', '==', buyerId),
        orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function listOrdersBySeller(sellerId: string): Promise<Order[]> {
    const q = query(
        collection(db, COLLECTION),
        where('sellerId', '==', sellerId),
        orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

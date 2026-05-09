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
import type { Order, OrderStatus, OrderType } from '@/lib/types/order';
import { tsMs } from '@/lib/utils/firestoreTimestamp';

// IMPORTANT: collection name + required fields must stay in lockstep with
// the `match /orders/{orderId}` block in adler-app/firestore.rules. Update
// transitions are restricted by `affectedKeys.hasOnly(['status',
// 'txSignature','updatedAt'])` so denormalized snapshots can never be
// backfilled — write them correctly at create time or never.
const ORDERS = 'orders';

function rowToOrder(id: string, data: Record<string, unknown>): Order {
    return {
        id,
        buyerId: (data.buyerId as string) ?? '',
        sellerId: (data.sellerId as string) ?? '',
        status: (data.status as OrderStatus) ?? 'pending',
        txSignature: (data.txSignature as string | null) ?? null,
        amountSol: (data.amountSol as number) ?? 0,
        feeSol: (data.feeSol as number) ?? 0,
        contractId32: (data.contractId32 as string | undefined) ?? null,
        escrowPda: (data.escrowPda as string | undefined) ?? null,
        type: (data.type as OrderType) ?? 'service',
        listingId: (data.listingId as string) ?? '',
        listingTitle: (data.listingTitle as string | undefined) ?? null,
        buyerHandle: (data.buyerHandle as string | undefined) ?? null,
        buyerDisplayName: (data.buyerDisplayName as string | undefined) ?? null,
        sellerHandle: (data.sellerHandle as string | undefined) ?? null,
        sellerDisplayName: (data.sellerDisplayName as string | undefined) ?? null,
        createdAt: tsMs(data.createdAt),
        updatedAt: tsMs(data.updatedAt),
    };
}

export interface CreateOrderInput {
    /**
     * Client-generated UUID. Used as the Firestore doc id AND the
     * `contract_id` derivation input on-chain — sha256(orderId) MUST equal
     * `contractId32`. Generating it client-side lets us derive the escrow
     * PDA before Firestore is written, which matters because the order-
     * update rule blocks adding `contractId32` / `escrowPda` after creation.
     */
    orderId: string;
    /** Hex-encoded sha256 of `orderId` — caller pre-computes via `deriveContractId`. */
    contractId32: string;
    /** Base58 escrow PDA — caller pre-computes via `deriveContractEscrowPda`. */
    escrowPda: string;
    sellerId: string;
    amountSol: number;
    /** Protocol fee withheld from the buyer's payment, in SOL. */
    feeSol: number;
    type: OrderType;
    listingId: string;
    listingTitle: string | null;
    buyerHandle: string | null;
    buyerDisplayName: string | null;
    sellerHandle: string | null;
    sellerDisplayName: string | null;
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    if (uid === input.sellerId) {
        throw new Error('Cannot buy your own listing');
    }
    // setDoc against a client-chosen id (vs. addDoc generating one
    // server-side) so the on-chain `contract_id` and `escrow_pda` are known
    // before the Firestore write — they're written into the doc atomically
    // with the rest of the create payload, then never mutated.
    await setDoc(doc(db, ORDERS, input.orderId), {
        buyerId: uid,
        sellerId: input.sellerId,
        status: 'pending' satisfies OrderStatus,
        txSignature: null,
        amountSol: input.amountSol,
        feeSol: input.feeSol,
        contractId32: input.contractId32,
        escrowPda: input.escrowPda,
        type: input.type,
        listingId: input.listingId,
        listingTitle: input.listingTitle,
        buyerHandle: input.buyerHandle,
        buyerDisplayName: input.buyerDisplayName,
        sellerHandle: input.sellerHandle,
        sellerDisplayName: input.sellerDisplayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return input.orderId;
}

export async function markOrderPaid(
    orderId: string,
    txSignature: string,
): Promise<void> {
    if (!txSignature) throw new Error('txSignature is required to mark paid');
    await updateDoc(doc(db, ORDERS, orderId), {
        status: 'paid' satisfies OrderStatus,
        txSignature,
        updatedAt: serverTimestamp(),
    });
}

export async function markOrderFailed(orderId: string): Promise<void> {
    await updateDoc(doc(db, ORDERS, orderId), {
        status: 'failed' satisfies OrderStatus,
        updatedAt: serverTimestamp(),
    });
}

// `pending → paid` is the only status transition written outside of
// threadsService for the v1 escrow flow. Step 4 wires `paid → delivered`
// and `delivered → complete` to the batched writes in
// `submitDeliverable` / `approveDeliverable` (message-log entry + order
// status atomic). Until then the legacy direct callers below give the
// step-1 UI a way to advance order state without touching threads.

export async function markOrderDelivered(orderId: string): Promise<void> {
    await updateDoc(doc(db, ORDERS, orderId), {
        status: 'delivered' satisfies OrderStatus,
        updatedAt: serverTimestamp(),
    });
}

export async function markOrderComplete(orderId: string): Promise<void> {
    await updateDoc(doc(db, ORDERS, orderId), {
        status: 'complete' satisfies OrderStatus,
        updatedAt: serverTimestamp(),
    });
}

export async function getOrder(orderId: string): Promise<Order | null> {
    const snap = await getDoc(doc(db, ORDERS, orderId));
    if (!snap.exists()) return null;
    return rowToOrder(snap.id, snap.data() as Record<string, unknown>);
}

// Sorted by createdAt desc to match the deployed firestore.indexes.json
// composite index. Don't switch to updatedAt without adding the matching
// index.
export async function listOrdersAsBuyer(uid: string): Promise<Order[]> {
    const snap = await getDocs(
        query(
            collection(db, ORDERS),
            where('buyerId', '==', uid),
            orderBy('createdAt', 'desc'),
        ),
    );
    return snap.docs.map((d) =>
        rowToOrder(d.id, d.data() as Record<string, unknown>),
    );
}

export async function listOrdersAsSeller(uid: string): Promise<Order[]> {
    const snap = await getDocs(
        query(
            collection(db, ORDERS),
            where('sellerId', '==', uid),
            orderBy('createdAt', 'desc'),
        ),
    );
    return snap.docs.map((d) =>
        rowToOrder(d.id, d.data() as Record<string, unknown>),
    );
}

export interface FeeHistoryStats {
    totalFeeSol: number;
    totalContractSol: number;
    last30FeeSol: number;
    settledCount: number;
}

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Pure aggregator for the Billing surface. Sums `feeSol` across the
 * caller's settled orders (status === "complete") in either role.
 * Unsettled orders contribute nothing — the protocol fee is recorded at
 * payment time but only "owed" once the contract resolves.
 */
export function feeHistoryStats(
    asBuyer: Order[],
    asSeller: Order[],
): FeeHistoryStats {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const seen = new Set<string>();
    const stats: FeeHistoryStats = {
        totalFeeSol: 0,
        totalContractSol: 0,
        last30FeeSol: 0,
        settledCount: 0,
    };
    for (const order of [...asBuyer, ...asSeller]) {
        if (seen.has(order.id)) continue;
        seen.add(order.id);
        if (order.status !== 'complete') continue;
        stats.totalFeeSol += order.feeSol;
        stats.totalContractSol += order.amountSol;
        stats.settledCount += 1;
        if (order.createdAt >= cutoff) {
            stats.last30FeeSol += order.feeSol;
        }
    }
    return stats;
}

export interface SpendStats {
    totalSettled: number;
    totalSettledCount: number;
    last30: number;
    last30Count: number;
    inFlight: number;
    inFlightCount: number;
}

/**
 * Pure aggregator for the Spend dashboard. Sums `amountSol` from the
 * buyer's perspective: complete orders count as settled, paid + delivered
 * orders count as in-flight, pending/failed are dropped.
 */
export function spendStats(orders: Order[]): SpendStats {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const stats: SpendStats = {
        totalSettled: 0,
        totalSettledCount: 0,
        last30: 0,
        last30Count: 0,
        inFlight: 0,
        inFlightCount: 0,
    };
    for (const order of orders) {
        if (order.status === 'complete') {
            stats.totalSettled += order.amountSol;
            stats.totalSettledCount += 1;
            if (order.createdAt >= cutoff) {
                stats.last30 += order.amountSol;
                stats.last30Count += 1;
            }
        } else if (order.status === 'paid' || order.status === 'delivered') {
            stats.inFlight += order.amountSol;
            stats.inFlightCount += 1;
        }
    }
    return stats;
}

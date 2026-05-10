import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { tsMs } from '@/lib/utils/firestoreTimestamp';
import { deriveBountyId } from '@/lib/escrow/pda';
import { BOUNTY_EXPIRY_SECS } from '@/lib/constants/escrow';
import type {
    Bounty,
    BountyMode,
    BountyScope,
    BountyStatus,
} from '@/lib/types/bounty';

const BOUNTIES = 'bounties';

function rowToBounty(id: string, data: Record<string, unknown>): Bounty {
    return {
        id,
        posterId: (data.posterId as string) ?? '',
        posterWalletAddress: (data.posterWalletAddress as string) ?? '',
        title: (data.title as string) ?? '',
        prompt: (data.prompt as string) ?? '',
        mode: (data.mode as BountyMode) ?? 'manual',
        bountyLamports: typeof data.bountyLamports === 'number' ? data.bountyLamports : 0,
        createdAt: tsMs(data.createdAt) || Date.now(),
        expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : tsMs(data.expiresAt),
        status: (data.status as BountyStatus) ?? 'open',
        scope: (data.scope as BountyScope) ?? 'public',
        groupId: (data.groupId as string | null) ?? null,
        winnerId: (data.winnerId as string | null) ?? null,
        winningSubmissionId: (data.winningSubmissionId as string | null) ?? null,
        txSignature: (data.txSignature as string | null) ?? null,
        reportCount: typeof data.reportCount === 'number' ? data.reportCount : 0,
        contractIdHex: (data.contractIdHex as string) ?? '',
        escrowFunded: data.escrowFunded === true,
    };
}

function assertCurrentUser(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    return uid;
}

export interface DraftBountyInput {
    title: string;
    prompt: string;
    mode: BountyMode;
    bountyLamports: number;
    posterWalletAddress: string;
    scope: BountyScope;
    groupId?: string | null;
}

export interface DraftBountyArtifact {
    docId: string;
    contractIdHex: string;
    expiresAt: number;
}

/**
 * Generate a Firestore-friendly doc id + its sha256 contractIdHex without
 * yet writing the doc. Used by `useBountyEscrow` to (1) precompute the
 * on-chain id, (2) sign + send `create_bounty`, (3) only THEN write the
 * Firestore doc with `escrowFunded: true`. Avoids ghost docs from failed
 * on-chain transactions.
 */
export async function draftBounty(): Promise<{ docId: string; contractIdHex: string; expiresAt: number }> {
    const uid = assertCurrentUser();
    const docRef = doc(collection(db, BOUNTIES));
    const id = await deriveBountyId(docRef.id);
    return {
        docId: docRef.id,
        contractIdHex: id.hex,
        expiresAt: Date.now() + BOUNTY_EXPIRY_SECS * 1000,
    };
}

export interface PersistBountyInput extends DraftBountyInput {
    docId: string;
    contractIdHex: string;
    expiresAt: number;
}

/**
 * Write the Firestore bounty doc after the on-chain create_bounty has
 * landed. Sets `escrowFunded: true`. Browse + Inbox queries surface
 * `status: 'open'` rows; if this write fails (e.g. network), the on-chain
 * SOL is still escrowed and `refund_bounty` after expiresAt recovers it.
 */
export async function persistBounty(input: PersistBountyInput): Promise<Bounty> {
    const uid = assertCurrentUser();
    const ref = doc(db, BOUNTIES, input.docId);
    const payload = {
        id: input.docId,
        posterId: uid,
        posterWalletAddress: input.posterWalletAddress,
        title: input.title.trim(),
        prompt: input.prompt.trim(),
        mode: input.mode,
        bountyLamports: input.bountyLamports,
        createdAt: serverTimestamp(),
        expiresAt: input.expiresAt,
        status: 'open' as const,
        scope: input.scope,
        groupId: input.groupId ?? null,
        winnerId: null,
        winningSubmissionId: null,
        txSignature: null,
        reportCount: 0,
        contractIdHex: input.contractIdHex,
        escrowFunded: true,
    };
    await setDoc(ref, payload);
    return rowToBounty(input.docId, { ...payload, createdAt: Date.now() });
}

export async function getBounty(id: string): Promise<Bounty | null> {
    const snap = await getDoc(doc(db, BOUNTIES, id));
    if (!snap.exists()) return null;
    return rowToBounty(snap.id, snap.data() as Record<string, unknown>);
}

export async function listOpenPublicBounties(max = 50): Promise<Bounty[]> {
    const snap = await getDocs(
        query(
            collection(db, BOUNTIES),
            where('scope', '==', 'public'),
            where('status', '==', 'open'),
            orderBy('createdAt', 'desc'),
            limit(max),
        ),
    );
    return snap.docs.map((d) => rowToBounty(d.id, d.data() as Record<string, unknown>));
}

export async function listGroupBounties(groupIds: string[], max = 50): Promise<Bounty[]> {
    if (groupIds.length === 0) return [];
    // Firestore `in` clause limit is 30; chunk if needed.
    const chunks: string[][] = [];
    for (let i = 0; i < groupIds.length; i += 30) {
        chunks.push(groupIds.slice(i, i + 30));
    }
    const all: Bounty[] = [];
    for (const chunk of chunks) {
        const snap = await getDocs(
            query(
                collection(db, BOUNTIES),
                where('groupId', 'in', chunk),
                where('status', '==', 'open'),
                orderBy('createdAt', 'desc'),
                limit(max),
            ),
        );
        snap.docs.forEach((d) => all.push(rowToBounty(d.id, d.data() as Record<string, unknown>)));
    }
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, max);
}

export async function listMyPostedBounties(uid: string, max = 50): Promise<Bounty[]> {
    const snap = await getDocs(
        query(
            collection(db, BOUNTIES),
            where('posterId', '==', uid),
            orderBy('createdAt', 'desc'),
            limit(max),
        ),
    );
    return snap.docs.map((d) => rowToBounty(d.id, d.data() as Record<string, unknown>));
}

/**
 * Manual-mode poster picks a winner. Updates Firestore directly with the
 * tx signature returned from the on-chain `settle_manual_bounty` call.
 * The rule allows this single open → settled transition for the poster.
 */
export async function markManualSettled(
    bountyId: string,
    winnerId: string,
    winningSubmissionId: string,
    txSignature: string,
): Promise<void> {
    assertCurrentUser();
    await updateDoc(doc(db, BOUNTIES, bountyId), {
        status: 'settled',
        winnerId,
        winningSubmissionId,
        txSignature,
        settledAt: serverTimestamp(),
    });
}

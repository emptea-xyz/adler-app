import {
    collection,
    deleteField,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { tsMs } from '@/lib/utils/firestoreTimestamp';
import { requireAuth } from '@/lib/utils/requireAuth';
import { deriveBountyId } from '@/lib/escrow/pda';
import { REVIEW_WINDOW_SECS, SUBMISSION_WINDOW_SECS } from '@/lib/constants/escrow';
import { getProfile } from '@/lib/services/profileService';
import type {
    Bounty,
    BountyScope,
    BountyStatus,
    BountySubmissionKind,
} from '@/lib/types/bounty';

const BOUNTIES = 'bounties';

function rowToBounty(id: string, data: Record<string, unknown>): Bounty {
    const createdAt = tsMs(data.createdAt) || Date.now();
    // Defensive read — older bounty docs may pre-date the
    // submissionEndsAt/expiresAt fields. When missing or 0, derive from
    // createdAt + the canonical 30d window so the UI doesn't render
    // "expired" against a bogus zero timestamp.
    const rawSubmissionEnds =
        typeof data.submissionEndsAt === 'number'
            ? data.submissionEndsAt
            : tsMs(data.submissionEndsAt);
    const submissionEndsAt =
        rawSubmissionEnds > 0
            ? rawSubmissionEnds
            : createdAt + SUBMISSION_WINDOW_SECS * 1000;
    const rawExpires =
        typeof data.expiresAt === 'number' ? data.expiresAt : tsMs(data.expiresAt);
    const expiresAt =
        rawExpires > 0
            ? rawExpires
            : submissionEndsAt + REVIEW_WINDOW_SECS * 1000;
    const kindRaw = data.submissionKind;
    const submissionKind: BountySubmissionKind =
        kindRaw === 'video' ? 'video' : kindRaw === 'link' ? 'link' : 'photo';
    return {
        id,
        posterId: (data.posterId as string) ?? '',
        posterWalletAddress: (data.posterWalletAddress as string) ?? '',
        title: (data.title as string) ?? '',
        prompt: (data.prompt as string) ?? '',
        bountyLamports: typeof data.bountyLamports === 'number' ? data.bountyLamports : 0,
        createdAt,
        submissionEndsAt,
        expiresAt,
        status: (data.status as BountyStatus) ?? 'open',
        scope: (data.scope as BountyScope) ?? 'public',
        groupId: (data.groupId as string | null) ?? null,
        winnerId: (data.winnerId as string | null) ?? null,
        winningSubmissionId: (data.winningSubmissionId as string | null) ?? null,
        settledAt: tsMs(data.settledAt) || null,
        txSignature: (data.txSignature as string | null) ?? null,
        reportCount: typeof data.reportCount === 'number' ? data.reportCount : 0,
        contractIdHex: (data.contractIdHex as string) ?? '',
        escrowFunded: data.escrowFunded === true,
        submissionCount:
            typeof data.submissionCount === 'number' ? data.submissionCount : 0,
        submissionKind,
    };
}

interface DraftBountyInput {
    title: string;
    prompt: string;
    bountyLamports: number;
    scope: BountyScope;
    groupId?: string | null;
    submissionKind: BountySubmissionKind;
}

export interface DraftBountyArtifact {
    docId: string;
    contractIdHex: string;
    submissionEndsAt: number;
    expiresAt: number;
}

/**
 * Generate a Firestore-friendly doc id client-side and derive the
 * sha256 contractIdHex used as the on-chain bounty id. No Firestore
 * write — `useBountyEscrow.post` writes the doc via `persistBounty`
 * BEFORE the on-chain `create_bounty` runs, so a failed on-chain
 * ix leaves a doc with `escrowFunded: false` that the
 * `expireBounties` sweep can reconcile (no ghost-escrow).
 */
export async function draftBounty(): Promise<DraftBountyArtifact> {
    requireAuth();
    const docRef = doc(collection(db, BOUNTIES));
    const id = await deriveBountyId(docRef.id);
    const now = Date.now();
    const submissionEndsAt = now + SUBMISSION_WINDOW_SECS * 1000;
    const expiresAt = submissionEndsAt + REVIEW_WINDOW_SECS * 1000;
    return {
        docId: docRef.id,
        contractIdHex: id.hex,
        submissionEndsAt,
        expiresAt,
    };
}

export interface PersistBountyInput extends DraftBountyInput {
    docId: string;
    contractIdHex: string;
    submissionEndsAt: number;
    expiresAt: number;
}

/**
 * Write the Firestore bounty doc as `escrowFunded: false`. Called
 * BEFORE the on-chain `create_bounty` runs so a doc always exists if
 * funds are on-chain. `posterWalletAddress` is derived from the
 * authenticated profile (M1) — clients can't claim someone else's
 * wallet. After the on-chain call lands, `markEscrowFunded` flips
 * the flag to `true`.
 */
export async function persistBounty(input: PersistBountyInput): Promise<Bounty> {
    const uid = requireAuth();
    const profile = await getProfile(uid);
    if (!profile?.walletAddress) {
        throw new Error('Profile wallet not set — sign in again');
    }
    const ref = doc(db, BOUNTIES, input.docId);
    const payload = {
        id: input.docId,
        posterId: uid,
        posterWalletAddress: profile.walletAddress,
        title: input.title.trim(),
        prompt: input.prompt.trim(),
        bountyLamports: input.bountyLamports,
        createdAt: serverTimestamp(),
        submissionEndsAt: input.submissionEndsAt,
        expiresAt: input.expiresAt,
        status: 'open' as const,
        scope: input.scope,
        groupId: input.groupId ?? null,
        winnerId: null,
        winningSubmissionId: null,
        txSignature: null,
        reportCount: 0,
        contractIdHex: input.contractIdHex,
        escrowFunded: false,
        submissionCount: 0,
        submissionKind: input.submissionKind,
    };
    await setDoc(ref, payload);
    return rowToBounty(input.docId, { ...payload, createdAt: Date.now() });
}

/**
 * Flip `escrowFunded: true` once the on-chain `create_bounty` has
 * landed. If this update fails (network, App Check), the doc remains
 * `escrowFunded: false` and the `expireBounties` Pass 0 reconcile
 * picks it up: PDA exists on-chain → flip to true; PDA missing →
 * mark `cancelled` (no funds to refund).
 */
export async function markEscrowFunded(bountyId: string): Promise<void> {
    requireAuth();
    await updateDoc(doc(db, BOUNTIES, bountyId), {
        escrowFunded: true,
    });
}

export async function getBounty(id: string): Promise<Bounty | null> {
    const snap = await getDoc(doc(db, BOUNTIES, id));
    if (!snap.exists()) return null;
    return rowToBounty(snap.id, snap.data() as Record<string, unknown>);
}

// Returns all open bounties (public + group). Group bounties are
// publicly browseable for discovery; submissions are gated to members.
export async function listOpenPublicBounties(max = 50): Promise<Bounty[]> {
    const snap = await getDocs(
        query(
            collection(db, BOUNTIES),
            where('status', '==', 'open'),
            orderBy('createdAt', 'desc'),
            limit(max),
        ),
    );
    return snap.docs.map((d) => rowToBounty(d.id, d.data() as Record<string, unknown>));
}

export async function listRecentSettledPublic(max = 15): Promise<Bounty[]> {
    const snap = await getDocs(
        query(
            collection(db, BOUNTIES),
            where('scope', '==', 'public'),
            where('status', '==', 'settled'),
            orderBy('settledAt', 'desc'),
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
 * Three-step cancel protocol — preserves invariants across the
 * (Firestore) submission counter and the (Solana) on-chain escrow.
 *
 * 1. `startCancel` runs a Firestore transaction that flips
 *    `open|in_review → cancelling` *only if* `submissionCount === 0`. If
 *    `enforceSubmissionCap` is racing in another transaction to increment
 *    the counter, exactly one wins; the other retries on stale data and
 *    aborts cleanly. Returns the prior status so a failure can be rolled
 *    back.
 * 2. Caller sends the on-chain `cancel_bounty` ix. The `cancelling`
 *    status blocks any further submissions in the meantime.
 * 3. On success → `finishCancel` writes `refunded` + tx signature.
 *    On error → `abortCancel` rolls status back to the recorded prior.
 */
export async function startCancel(bountyId: string): Promise<{ from: BountyStatus }> {
    requireAuth();
    const ref = doc(db, BOUNTIES, bountyId);
    return await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Bounty no longer exists');
        const data = snap.data() as Record<string, unknown>;
        const count = typeof data.submissionCount === 'number' ? data.submissionCount : 0;
        if (count > 0) throw new Error('A submission has already been made.');
        const from = data.status as BountyStatus;
        if (from !== 'open' && from !== 'in_review') {
            throw new Error("This bounty can't be cancelled.");
        }
        tx.update(ref, {
            status: 'cancelling' as const,
            cancellingFromStatus: from,
        });
        return { from };
    });
}

export async function finishCancel(
    bountyId: string,
    txSignature: string,
): Promise<void> {
    requireAuth();
    await updateDoc(doc(db, BOUNTIES, bountyId), {
        status: 'refunded',
        txSignature,
        refundedAt: serverTimestamp(),
        cancellingFromStatus: deleteField(),
    });
}

export async function abortCancel(
    bountyId: string,
    revertTo: BountyStatus,
): Promise<void> {
    requireAuth();
    await updateDoc(doc(db, BOUNTIES, bountyId), {
        status: revertTo,
        cancellingFromStatus: deleteField(),
    });
}

/**
 * Poster picks a winner. Updates Firestore directly with the tx signature
 * returned from the on-chain `settle_manual_bounty` call. The rule allows
 * this single open|in_review → settled transition for the poster.
 */
export async function markManualSettled(
    bountyId: string,
    winnerId: string,
    winningSubmissionId: string,
    txSignature: string,
): Promise<void> {
    requireAuth();
    await updateDoc(doc(db, BOUNTIES, bountyId), {
        status: 'settled',
        winnerId,
        winningSubmissionId,
        txSignature,
        settledAt: serverTimestamp(),
    });
}

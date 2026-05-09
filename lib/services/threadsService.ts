import {
    addDoc,
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
import {
    MESSAGE_ATTACHMENTS_MAX,
    MESSAGE_BODY_MAX,
    MESSAGE_PREVIEW_MAX,
    type Message,
    type MessageKind,
    type ParticipantSnapshot,
    type Thread,
    type ThreadKind,
} from '@/lib/types/thread';
import { tsMs } from '@/lib/utils/firestoreTimestamp';

const THREADS = 'threads';

function truncatePreview(body: string): string {
    const trimmed = body.trim();
    if (!trimmed) return '';
    return trimmed.length <= MESSAGE_PREVIEW_MAX
        ? trimmed
        : `${trimmed.slice(0, MESSAGE_PREVIEW_MAX - 1)}…`;
}

function normalizeAttachments(values: string[]): string[] {
    return values
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
}

function assertMessageBody(body: string): void {
    if (!body) throw new Error('Message body is required');
    if (body.length > MESSAGE_BODY_MAX) {
        throw new Error(`Message must be ${MESSAGE_BODY_MAX} characters or less`);
    }
}

function readParticipantSnapshot(value: unknown): ParticipantSnapshot {
    const map = (value as Record<string, unknown> | undefined) ?? {};
    return {
        handle: typeof map.handle === 'string' ? map.handle : null,
        displayName: typeof map.displayName === 'string' ? map.displayName : null,
        avatarUrl: typeof map.avatarUrl === 'string' ? map.avatarUrl : null,
    };
}

function readUnread(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object') return {};
    const map = value as Record<string, unknown>;
    const out: Record<string, number> = {};
    Object.entries(map).forEach(([key, raw]) => {
        out[key] = typeof raw === 'number' ? raw : 0;
    });
    return out;
}

function readSnapshots(value: unknown): Record<string, ParticipantSnapshot> {
    if (!value || typeof value !== 'object') return {};
    const map = value as Record<string, unknown>;
    const out: Record<string, ParticipantSnapshot> = {};
    Object.entries(map).forEach(([uid, raw]) => {
        out[uid] = readParticipantSnapshot(raw);
    });
    return out;
}

function rowToThread(id: string, data: Record<string, unknown>): Thread {
    const participants = Array.isArray(data.participants)
        ? data.participants.filter((v): v is string => typeof v === 'string')
        : [];
    return {
        id,
        kind: ((data.kind as ThreadKind | undefined) ?? 'application') as ThreadKind,
        parentId: (data.parentId as string) ?? '',
        parentTitle: (data.parentTitle as string | undefined) ?? null,
        participants,
        participantSnapshots: readSnapshots(data.participantSnapshots),
        lastMessageAt: tsMs(data.lastMessageAt),
        lastMessagePreview: (data.lastMessagePreview as string) ?? '',
        lastMessageSenderId: (data.lastMessageSenderId as string | undefined) ?? null,
        unreadCount: readUnread(data.unreadCount),
        createdAt: tsMs(data.createdAt),
        updatedAt: tsMs(data.updatedAt),
    };
}

function rowToMessage(threadId: string, id: string, data: Record<string, unknown>): Message {
    const attachments = Array.isArray(data.attachments)
        ? data.attachments.filter((v): v is string => typeof v === 'string')
        : [];
    return {
        id,
        threadId,
        senderId: (data.senderId as string) ?? '',
        kind: ((data.kind as MessageKind | undefined) ?? 'text') as MessageKind,
        body: (data.body as string) ?? '',
        attachments,
        createdAt: tsMs(data.createdAt),
        escrowTxSignature: (data.escrowTxSignature as string | undefined) ?? null,
        escrowTxConfirmedAt: data.escrowTxConfirmedAt == null ? null : tsMs(data.escrowTxConfirmedAt),
    };
}

export function threadIdFor(kind: ThreadKind, parentId: string): string {
    return `${kind}_${parentId}`;
}

export interface CreateApplicationThreadInput {
    applicationId: string;
    gigTitle: string | null;
    creator: { uid: string; handle: string | null; displayName: string | null; avatarUrl: string | null };
    brand: { uid: string; handle: string | null; displayName: string | null; avatarUrl: string | null };
    pitchBody?: string;
}

async function ensureThread(input: {
    id: string;
    kind: ThreadKind;
    parentId: string;
    parentTitle: string | null;
    participants: [string, string];
    participantSnapshots: Record<string, ParticipantSnapshot>;
    seedPreview?: string;
    seedSenderId?: string | null;
}): Promise<{ id: string; created: boolean }> {
    const ref = doc(db, THREADS, input.id);
    const existing = await getDoc(ref);
    if (existing.exists()) return { id: input.id, created: false };

    const seedPreview = truncatePreview(input.seedPreview ?? '');
    await setDoc(ref, {
        kind: input.kind,
        parentId: input.parentId,
        parentTitle: input.parentTitle ?? null,
        participants: input.participants,
        participantSnapshots: input.participantSnapshots,
        lastMessageAt: serverTimestamp(),
        lastMessagePreview: seedPreview,
        lastMessageSenderId: input.seedSenderId ?? null,
        unreadCount: {
            [input.participants[0]]: 0,
            [input.participants[1]]: 0,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return { id: input.id, created: true };
}

export async function createApplicationThread(input: CreateApplicationThreadInput): Promise<string> {
    const id = threadIdFor('application', input.applicationId);
    const participants: [string, string] = [input.creator.uid, input.brand.uid];
    const snapshots: Record<string, ParticipantSnapshot> = {
        [input.creator.uid]: {
            handle: input.creator.handle,
            displayName: input.creator.displayName,
            avatarUrl: input.creator.avatarUrl,
        },
        [input.brand.uid]: {
            handle: input.brand.handle,
            displayName: input.brand.displayName,
            avatarUrl: input.brand.avatarUrl,
        },
    };

    const seeded = await ensureThread({
        id,
        kind: 'application',
        parentId: input.applicationId,
        parentTitle: input.gigTitle ?? null,
        participants,
        participantSnapshots: snapshots,
        seedPreview: input.pitchBody ?? '',
        seedSenderId: input.pitchBody?.trim() ? input.creator.uid : null,
    });

    if (seeded.created && input.pitchBody?.trim()) {
        const messageRef = collection(db, THREADS, id, 'messages');
        await addDoc(messageRef, {
            threadId: id,
            senderId: input.creator.uid,
            kind: 'text' as MessageKind,
            body: input.pitchBody.trim(),
            attachments: [],
            escrowTxSignature: null,
            escrowTxConfirmedAt: null,
            createdAt: serverTimestamp(),
        });
    }

    return id;
}

export interface CreateOrderThreadInput {
    orderId: string;
    parentTitle: string | null;
    buyer: { uid: string; handle: string | null; displayName: string | null; avatarUrl: string | null };
    seller: { uid: string; handle: string | null; displayName: string | null; avatarUrl: string | null };
}

export async function createOrderThread(input: CreateOrderThreadInput): Promise<string> {
    const id = threadIdFor('order', input.orderId);
    const participants: [string, string] = [input.buyer.uid, input.seller.uid];
    const snapshots: Record<string, ParticipantSnapshot> = {
        [input.buyer.uid]: {
            handle: input.buyer.handle,
            displayName: input.buyer.displayName,
            avatarUrl: input.buyer.avatarUrl,
        },
        [input.seller.uid]: {
            handle: input.seller.handle,
            displayName: input.seller.displayName,
            avatarUrl: input.seller.avatarUrl,
        },
    };
    await ensureThread({
        id,
        kind: 'order',
        parentId: input.orderId,
        parentTitle: input.parentTitle,
        participants,
        participantSnapshots: snapshots,
    });
    return id;
}

export async function listMyThreads(uid: string): Promise<Thread[]> {
    const snap = await getDocs(
        query(
            collection(db, THREADS),
            where('participants', 'array-contains', uid),
            orderBy('lastMessageAt', 'desc'),
        ),
    );
    return snap.docs.map((row) => rowToThread(row.id, row.data() as Record<string, unknown>));
}

export async function getThread(threadId: string): Promise<Thread | null> {
    const snap = await getDoc(doc(db, THREADS, threadId));
    if (!snap.exists()) return null;
    return rowToThread(snap.id, snap.data() as Record<string, unknown>);
}

export async function listMessages(threadId: string): Promise<Message[]> {
    const snap = await getDocs(
        query(collection(db, THREADS, threadId, 'messages'), orderBy('createdAt', 'asc')),
    );
    return snap.docs.map((row) => rowToMessage(threadId, row.id, row.data() as Record<string, unknown>));
}

export interface SendMessageInput {
    threadId: string;
    kind?: 'text' | 'deliverable' | 'revision_request' | 'approval' | 'system';
    body: string;
    attachments?: string[];
    messageId?: string;
    escrowTxSignature?: string | null;
    escrowTxConfirmedAt?: number | null;
}

export async function sendMessage(input: SendMessageInput): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');

    const body = input.body.trim();
    assertMessageBody(body);

    const attachments = normalizeAttachments(input.attachments ?? []);
    if (attachments.length > MESSAGE_ATTACHMENTS_MAX) {
        throw new Error(`Add up to ${MESSAGE_ATTACHMENTS_MAX} attachments`);
    }

    const payload = {
        threadId: input.threadId,
        senderId: uid,
        kind: (input.kind ?? 'text') as MessageKind,
        body,
        attachments,
        escrowTxSignature: input.escrowTxSignature ?? null,
        escrowTxConfirmedAt: input.escrowTxConfirmedAt ?? null,
        createdAt: serverTimestamp(),
    };

    if (input.messageId) {
        await setDoc(
            doc(db, THREADS, input.threadId, 'messages', input.messageId),
            payload,
        );
        return input.messageId;
    }

    const ref = await addDoc(collection(db, THREADS, input.threadId, 'messages'), payload);
    return ref.id;
}

export async function markThreadRead(threadId: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await updateDoc(doc(db, THREADS, threadId), {
        [`unreadCount.${uid}`]: 0,
        updatedAt: serverTimestamp(),
    });
}

export interface SubmitDeliverableInput {
    threadId: string;
    orderId: string;
    body: string;
    attachments?: string[];
    messageId?: string;
    /** On-chain `submit_delivery` signature; lives on the message doc. */
    escrowTxSignature?: string;
}

export async function submitDeliverable(input: SubmitDeliverableInput): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');

    const body = input.body.trim();
    assertMessageBody(body);
    const attachments = normalizeAttachments(input.attachments ?? []);
    if (attachments.length > MESSAGE_ATTACHMENTS_MAX) {
        throw new Error(`Add up to ${MESSAGE_ATTACHMENTS_MAX} attachments`);
    }

    const batch = writeBatch(db);
    const messageRef = input.messageId
        ? doc(db, THREADS, input.threadId, 'messages', input.messageId)
        : doc(collection(db, THREADS, input.threadId, 'messages'));
    batch.set(messageRef, {
        threadId: input.threadId,
        senderId: uid,
        kind: 'deliverable' as MessageKind,
        body,
        attachments,
        escrowTxSignature: input.escrowTxSignature ?? null,
        escrowTxConfirmedAt: null,
        createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orders', input.orderId), {
        status: 'delivered',
        updatedAt: serverTimestamp(),
    });
    await batch.commit();
}

export interface RequestRevisionInput {
    threadId: string;
    body: string;
}

export async function requestRevision(input: RequestRevisionInput): Promise<void> {
    await sendMessage({
        threadId: input.threadId,
        kind: 'revision_request',
        body: input.body,
    });
}

export interface ApproveDeliverableInput {
    threadId: string;
    orderId: string;
    body?: string;
    messageId?: string;
    /** On-chain `approve_release` signature; lives on the message doc. */
    escrowTxSignature?: string;
}

export async function approveDeliverable(input: ApproveDeliverableInput): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const body = input.body?.trim() ? input.body.trim() : 'Approved.';
    assertMessageBody(body);

    const batch = writeBatch(db);
    const messageRef = input.messageId
        ? doc(db, THREADS, input.threadId, 'messages', input.messageId)
        : doc(collection(db, THREADS, input.threadId, 'messages'));
    batch.set(messageRef, {
        threadId: input.threadId,
        senderId: uid,
        kind: 'approval' as MessageKind,
        body,
        attachments: [],
        escrowTxSignature: input.escrowTxSignature ?? null,
        escrowTxConfirmedAt: null,
        createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orders', input.orderId), {
        status: 'complete',
        updatedAt: serverTimestamp(),
    });
    await batch.commit();
}

export function countRevisionRequests(messages: Message[]): number {
    return messages.filter((m) => m.kind === 'revision_request').length;
}

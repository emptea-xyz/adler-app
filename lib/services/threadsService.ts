// Stub. Implemented in step 3 (Authoring + applications + threads). Until
// then any consumer that imports a thread function will throw at runtime
// — but the type signatures resolve so the typecheck stays clean.

import type { Message, Thread, ThreadKind } from '@/lib/types/thread';

const NOT_IMPLEMENTED = (fn: string) =>
    new Error(`threadsService.${fn} is not implemented yet (step 3).`);

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

export async function createApplicationThread(
    _input: CreateApplicationThreadInput,
): Promise<string> {
    throw NOT_IMPLEMENTED('createApplicationThread');
}

export interface CreateOrderThreadInput {
    orderId: string;
    parentTitle: string | null;
    buyer: { uid: string; handle: string | null; displayName: string | null; avatarUrl: string | null };
    seller: { uid: string; handle: string | null; displayName: string | null; avatarUrl: string | null };
}

export async function createOrderThread(
    _input: CreateOrderThreadInput,
): Promise<string> {
    throw NOT_IMPLEMENTED('createOrderThread');
}

export async function listMyThreads(_uid: string): Promise<Thread[]> {
    throw NOT_IMPLEMENTED('listMyThreads');
}

export async function getThread(_threadId: string): Promise<Thread | null> {
    throw NOT_IMPLEMENTED('getThread');
}

export async function listMessages(_threadId: string): Promise<Message[]> {
    throw NOT_IMPLEMENTED('listMessages');
}

export interface SendMessageInput {
    threadId: string;
    kind?: 'text' | 'deliverable' | 'revision_request' | 'approval' | 'system';
    body: string;
    attachments?: string[];
}

export async function sendMessage(_input: SendMessageInput): Promise<string> {
    throw NOT_IMPLEMENTED('sendMessage');
}

export async function markThreadRead(_threadId: string): Promise<void> {
    throw NOT_IMPLEMENTED('markThreadRead');
}

export interface SubmitDeliverableInput {
    threadId: string;
    orderId: string;
    body: string;
    attachments?: string[];
    /** On-chain `submit_delivery` signature; lives on the message doc. */
    escrowTxSignature?: string;
}

export async function submitDeliverable(
    _input: SubmitDeliverableInput,
): Promise<void> {
    throw NOT_IMPLEMENTED('submitDeliverable');
}

export interface RequestRevisionInput {
    threadId: string;
    body: string;
}

export async function requestRevision(
    _input: RequestRevisionInput,
): Promise<void> {
    throw NOT_IMPLEMENTED('requestRevision');
}

export interface ApproveDeliverableInput {
    threadId: string;
    orderId: string;
    body?: string;
    /** On-chain `approve_release` signature; lives on the message doc. */
    escrowTxSignature?: string;
}

export async function approveDeliverable(
    _input: ApproveDeliverableInput,
): Promise<void> {
    throw NOT_IMPLEMENTED('approveDeliverable');
}

export function countRevisionRequests(messages: Message[]): number {
    return messages.filter((m) => m.kind === 'revision_request').length;
}

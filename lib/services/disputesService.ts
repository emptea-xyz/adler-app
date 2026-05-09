// Stub. Implemented in step 4 (Money + disputes + notifications + settings).
// Type signatures resolve so the future-step query-key wiring compiles
// today.

import type { Dispute, DisputeOutcome } from '@/lib/types/dispute';

const NOT_IMPLEMENTED = (fn: string) =>
    new Error(`disputesService.${fn} is not implemented yet (step 4).`);

export async function getDispute(_disputeId: string): Promise<Dispute | null> {
    throw NOT_IMPLEMENTED('getDispute');
}

export async function getDisputeByOrder(
    _orderId: string,
): Promise<Dispute | null> {
    throw NOT_IMPLEMENTED('getDisputeByOrder');
}

export interface FileDisputeInput {
    orderId: string;
    reason: string;
}

export async function fileDispute(_input: FileDisputeInput): Promise<string> {
    throw NOT_IMPLEMENTED('fileDispute');
}

export interface ResolveDisputeInput {
    disputeId: string;
    outcome: DisputeOutcome;
    outcomeNote: string;
    splitPercentToCreator?: number;
}

export async function resolveDispute(
    _input: ResolveDisputeInput,
): Promise<void> {
    throw NOT_IMPLEMENTED('resolveDispute');
}

export async function listOpenDisputes(): Promise<Dispute[]> {
    throw NOT_IMPLEMENTED('listOpenDisputes');
}

export async function listResolvedDisputes(): Promise<Dispute[]> {
    throw NOT_IMPLEMENTED('listResolvedDisputes');
}

export async function listDisputesByParticipant(
    _uid: string,
): Promise<Dispute[]> {
    throw NOT_IMPLEMENTED('listDisputesByParticipant');
}

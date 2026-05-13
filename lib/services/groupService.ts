import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { db, functions } from '@/lib/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { tsMs } from '@/lib/utils/firestoreTimestamp';
import type {
    Group,
    GroupMember,
    GroupRole,
    GroupStatus,
    JoinRequest,
} from '@/lib/types/group';

const GROUPS = 'groups';
const GROUP_MEMBERS = 'groupMembers';
const JOIN_REQUESTS = 'joinRequests';

function rowToGroup(id: string, data: Record<string, unknown>): Group {
    return {
        id,
        name: (data.name as string) ?? '',
        description: (data.description as string) ?? '',
        ownerId: (data.ownerId as string) ?? '',
        createdAt: tsMs(data.createdAt) || Date.now(),
        status: (data.status as GroupStatus) ?? 'pending',
        memberCount: typeof data.memberCount === 'number' ? data.memberCount : 0,
        openBountyTotalLamports:
            typeof data.openBountyTotalLamports === 'number' ? data.openBountyTotalLamports : 0,
        logoUrl: (data.logoUrl as string | null | undefined) ?? null,
    };
}

function rowToMember(id: string, data: Record<string, unknown>): GroupMember {
    return {
        id,
        groupId: (data.groupId as string) ?? '',
        uid: (data.uid as string) ?? '',
        joinedAt: tsMs(data.joinedAt) || Date.now(),
        role: (data.role as GroupRole) ?? 'member',
    };
}

function rowToJoinRequest(id: string, data: Record<string, unknown>): JoinRequest {
    return {
        id,
        groupId: (data.groupId as string) ?? '',
        uid: (data.uid as string) ?? '',
        createdAt: tsMs(data.createdAt) || Date.now(),
    };
}

export async function getGroup(id: string): Promise<Group | null> {
    const snap = await getDoc(doc(db, GROUPS, id));
    if (!snap.exists()) return null;
    return rowToGroup(snap.id, snap.data() as Record<string, unknown>);
}

async function listGroups(max = 50): Promise<Group[]> {
    const snap = await getDocs(
        query(
            collection(db, GROUPS),
            where('status', '==', 'active'),
            orderBy('memberCount', 'desc'),
            limit(max),
        ),
    );
    return snap.docs.map((d) => rowToGroup(d.id, d.data() as Record<string, unknown>));
}

export async function searchGroups(q: string, max = 30): Promise<Group[]> {
    // Client-side substring filter over listGroups() for v1.
    // Firestore has no native full-text search; revisit with Algolia/Typesense
    // once the catalog grows.
    const all = await listGroups(200);
    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, max);
    return all.filter((g) => g.name.toLowerCase().includes(needle)).slice(0, max);
}

export async function listMyMemberships(uid: string): Promise<GroupMember[]> {
    const snap = await getDocs(
        query(
            collection(db, GROUP_MEMBERS),
            where('uid', '==', uid),
            orderBy('joinedAt', 'desc'),
            limit(100),
        ),
    );
    return snap.docs.map((d) => rowToMember(d.id, d.data() as Record<string, unknown>));
}

export async function listGroupMembers(groupId: string, max = 100): Promise<GroupMember[]> {
    const snap = await getDocs(
        query(
            collection(db, GROUP_MEMBERS),
            where('groupId', '==', groupId),
            orderBy('joinedAt', 'desc'),
            limit(max),
        ),
    );
    return snap.docs.map((d) => rowToMember(d.id, d.data() as Record<string, unknown>));
}

// ── Admin-only callables ────────────────────────────────────────────────
// Server-side: `updateGroup`, `addGroupMember`, `removeGroupMember` in
// functions/index.js. All gated by `assertGroupAdmin(callerUid, groupId)`.

export async function updateGroup(input: {
    groupId: string;
    name?: string;
    description?: string;
    /** Pass `null` to clear the logo, a Firebase Storage URL to set one. */
    logoUrl?: string | null;
}): Promise<void> {
    const fn = httpsCallable(functions, 'updateGroup');
    await fn(input);
}

export interface AddGroupMemberResult {
    uid: string;
    displayName: string;
}

export async function addGroupMember(input: {
    groupId: string;
    identifier: string;
}): Promise<AddGroupMemberResult> {
    const fn = httpsCallable<typeof input, AddGroupMemberResult>(functions, 'addGroupMember');
    const res = await fn(input);
    return res.data;
}

export async function removeGroupMember(input: {
    groupId: string;
    uid: string;
}): Promise<void> {
    const fn = httpsCallable(functions, 'removeGroupMember');
    await fn(input);
}

// ── Join requests ──────────────────────────────────────────────────────

export async function listJoinRequests(groupId: string, max = 100): Promise<JoinRequest[]> {
    const snap = await getDocs(
        query(
            collection(db, JOIN_REQUESTS),
            where('groupId', '==', groupId),
            orderBy('createdAt', 'asc'),
            limit(max),
        ),
    );
    return snap.docs.map((d) => rowToJoinRequest(d.id, d.data() as Record<string, unknown>));
}

export async function getMyJoinRequest(
    groupId: string,
    uid: string,
): Promise<JoinRequest | null> {
    const snap = await getDoc(doc(db, JOIN_REQUESTS, `${groupId}_${uid}`));
    if (!snap.exists()) return null;
    return rowToJoinRequest(snap.id, snap.data() as Record<string, unknown>);
}

export async function requestToJoinGroup(input: {
    groupId: string;
}): Promise<{ ok: boolean; alreadyPending: boolean }> {
    const fn = httpsCallable<typeof input, { ok: boolean; alreadyPending: boolean }>(
        functions,
        'requestToJoinGroup',
    );
    const res = await fn(input);
    return res.data;
}

export async function approveJoinRequest(input: {
    groupId: string;
    uid: string;
}): Promise<void> {
    const fn = httpsCallable(functions, 'approveJoinRequest');
    await fn(input);
}

export async function rejectJoinRequest(input: {
    groupId: string;
    uid: string;
}): Promise<void> {
    const fn = httpsCallable(functions, 'rejectJoinRequest');
    await fn(input);
}

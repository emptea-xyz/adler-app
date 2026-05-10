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
    where,
} from 'firebase/firestore';
import { auth, db, functions } from '@/lib/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { tsMs } from '@/lib/utils/firestoreTimestamp';
import type {
    Group,
    GroupMember,
    GroupRole,
    GroupStatus,
    JoinRequest,
    JoinRequestStatus,
} from '@/lib/types/group';

const GROUPS = 'groups';
const GROUP_MEMBERS = 'groupMembers';
const JOIN_REQUESTS = 'joinRequests';
const GROUP_CREATION_REQUESTS = 'groupCreationRequests';

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
        requestedAt: tsMs(data.requestedAt) || Date.now(),
        status: (data.status as JoinRequestStatus) ?? 'pending',
    };
}

export async function getGroup(id: string): Promise<Group | null> {
    const snap = await getDoc(doc(db, GROUPS, id));
    if (!snap.exists()) return null;
    return rowToGroup(snap.id, snap.data() as Record<string, unknown>);
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

export async function requestGroupCreation(name: string, description: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    await addDoc(collection(db, GROUP_CREATION_REQUESTS), {
        name: name.trim(),
        description: description.trim(),
        requesterId: uid,
        status: 'pending',
        createdAt: serverTimestamp(),
    });
}

export async function requestJoinGroup(groupId: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    const id = `${groupId}_${uid}`;
    await setDoc(doc(db, JOIN_REQUESTS, id), {
        groupId,
        uid,
        requestedAt: serverTimestamp(),
        status: 'pending',
    });
}

export async function listJoinRequests(groupId: string): Promise<JoinRequest[]> {
    const snap = await getDocs(
        query(
            collection(db, JOIN_REQUESTS),
            where('groupId', '==', groupId),
            where('status', '==', 'pending'),
            orderBy('requestedAt', 'asc'),
        ),
    );
    return snap.docs.map((d) => rowToJoinRequest(d.id, d.data() as Record<string, unknown>));
}

export async function approveJoinRequest(requestId: string): Promise<void> {
    const fn = httpsCallable(functions, 'approveJoinRequest');
    await fn({ requestId });
}

export async function rejectJoinRequest(requestId: string): Promise<void> {
    const fn = httpsCallable(functions, 'rejectJoinRequest');
    await fn({ requestId });
}

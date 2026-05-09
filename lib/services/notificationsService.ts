import {
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
    AdlerNotification,
    NotificationKind,
    NotificationRefs,
} from '@/lib/types/notification';
import { tsMs } from '@/lib/utils/firestoreTimestamp';

const NOTIFICATIONS = 'notifications';

function readRefs(value: unknown): NotificationRefs {
    if (!value || typeof value !== 'object') return {};
    const raw = value as Record<string, unknown>;
    const refs: NotificationRefs = {};
    if (typeof raw.orderId === 'string') refs.orderId = raw.orderId;
    if (typeof raw.threadId === 'string') refs.threadId = raw.threadId;
    if (typeof raw.applicationId === 'string') refs.applicationId = raw.applicationId;
    if (typeof raw.listingId === 'string') refs.listingId = raw.listingId;
    if (typeof raw.disputeId === 'string') refs.disputeId = raw.disputeId;
    return refs;
}

function rowToNotification(
    id: string,
    data: Record<string, unknown>,
): AdlerNotification {
    return {
        id,
        recipientId: (data.recipientId as string) ?? '',
        kind: ((data.kind as NotificationKind | undefined) ??
            'system') as NotificationKind,
        title: (data.title as string) ?? '',
        body: (data.body as string) ?? '',
        href: (data.href as string) ?? '/(home)/(tabs)/browse',
        read: data.read === true,
        refs: readRefs(data.refs),
        createdAt: tsMs(data.createdAt),
    };
}

export async function listMyNotifications(
    uid: string,
): Promise<AdlerNotification[]> {
    const snap = await getDocs(
        query(
            collection(db, NOTIFICATIONS),
            where('recipientId', '==', uid),
            orderBy('createdAt', 'desc'),
            limit(100),
        ),
    );
    return snap.docs.map((row) =>
        rowToNotification(row.id, row.data() as Record<string, unknown>),
    );
}

export async function markNotificationRead(id: string): Promise<void> {
    await updateDoc(doc(db, NOTIFICATIONS, id), { read: true });
}

export async function markAllRead(
    notifications: AdlerNotification[],
): Promise<void> {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => markNotificationRead(n.id)));
}

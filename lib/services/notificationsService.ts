import {
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    updateDoc,
    where,
    writeBatch,
    type QueryDocumentSnapshot,
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
    if (typeof raw.bountyId === 'string') refs.bountyId = raw.bountyId;
    if (typeof raw.submissionId === 'string') refs.submissionId = raw.submissionId;
    if (typeof raw.groupId === 'string') refs.groupId = raw.groupId;
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

export const NOTIFICATIONS_PAGE_SIZE = 30;

export interface NotificationsPage {
    items: AdlerNotification[];
    /** Cursor to pass to the next call; null when we've reached the tail. */
    nextCursor: QueryDocumentSnapshot | null;
}

export async function listMyNotifications(
    uid: string,
    cursor?: QueryDocumentSnapshot | null,
): Promise<NotificationsPage> {
    const base = query(
        collection(db, NOTIFICATIONS),
        where('recipientId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(NOTIFICATIONS_PAGE_SIZE),
    );
    const snap = await getDocs(
        cursor
            ? query(
                  collection(db, NOTIFICATIONS),
                  where('recipientId', '==', uid),
                  orderBy('createdAt', 'desc'),
                  startAfter(cursor),
                  limit(NOTIFICATIONS_PAGE_SIZE),
              )
            : base,
    );
    const items = snap.docs.map((row) =>
        rowToNotification(row.id, row.data() as Record<string, unknown>),
    );
    const nextCursor =
        snap.docs.length === NOTIFICATIONS_PAGE_SIZE
            ? snap.docs[snap.docs.length - 1]
            : null;
    return { items, nextCursor };
}

export async function countUnread(uid: string): Promise<number> {
    // We deliberately use a `limit(50)` here rather than Firestore
    // `count()` to keep the read free under the existing per-uid index;
    // 50 is enough to drive the badge UI ("50+" is fine).
    const snap = await getDocs(
        query(
            collection(db, NOTIFICATIONS),
            where('recipientId', '==', uid),
            where('read', '==', false),
            limit(50),
        ),
    );
    return snap.size;
}

export async function markNotificationRead(id: string): Promise<void> {
    await updateDoc(doc(db, NOTIFICATIONS, id), { read: true });
}

/**
 * Flip every unread notification to read in a single round-trip per
 * batch (Firestore caps writeBatch at 500 ops). Without this each
 * notification would be a separate write — 100 docs == 100 writes,
 * easily tripping the per-second write rate.
 */
export async function markAllRead(
    notifications: AdlerNotification[],
): Promise<void> {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const BATCH = 400;
    for (let i = 0; i < unread.length; i += BATCH) {
        const slice = unread.slice(i, i + BATCH);
        const batch = writeBatch(db);
        slice.forEach((n) => batch.update(doc(db, NOTIFICATIONS, n.id), { read: true }));
        await batch.commit();
    }
}

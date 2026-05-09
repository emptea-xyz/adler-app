// Stub. Implemented in step 4. The Cloud Functions in
// adler-app/functions/index.js are the only writer to this collection;
// clients can only read their own and flip `read: true`.

import type { AdlerNotification } from '@/lib/types/notification';

const NOT_IMPLEMENTED = (fn: string) =>
    new Error(`notificationsService.${fn} is not implemented yet (step 4).`);

export async function listMyNotifications(
    _uid: string,
): Promise<AdlerNotification[]> {
    throw NOT_IMPLEMENTED('listMyNotifications');
}

export async function markNotificationRead(_id: string): Promise<void> {
    throw NOT_IMPLEMENTED('markNotificationRead');
}

export async function markAllRead(
    _notifications: AdlerNotification[],
): Promise<void> {
    throw NOT_IMPLEMENTED('markAllRead');
}

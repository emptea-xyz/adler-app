import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { NotificationKind } from '@/lib/types/notification';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    DEFAULT_PREFERENCES,
    type UserPreferences,
} from '@/lib/types/preferences';
import { tsMs } from '@/lib/utils/firestoreTimestamp';

const PREFERENCES = 'preferences';

function mergeNotificationPrefs(
    value: unknown,
): UserPreferences['notifications'] {
    const source =
        value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : {};
    return {
        application_received:
            typeof source.application_received === 'boolean'
                ? source.application_received
                : DEFAULT_NOTIFICATION_PREFERENCES.application_received,
        application_decided:
            typeof source.application_decided === 'boolean'
                ? source.application_decided
                : DEFAULT_NOTIFICATION_PREFERENCES.application_decided,
        order_state:
            typeof source.order_state === 'boolean'
                ? source.order_state
                : DEFAULT_NOTIFICATION_PREFERENCES.order_state,
        thread_message:
            typeof source.thread_message === 'boolean'
                ? source.thread_message
                : DEFAULT_NOTIFICATION_PREFERENCES.thread_message,
        dispute_filed:
            typeof source.dispute_filed === 'boolean'
                ? source.dispute_filed
                : DEFAULT_NOTIFICATION_PREFERENCES.dispute_filed,
        dispute_resolved:
            typeof source.dispute_resolved === 'boolean'
                ? source.dispute_resolved
                : DEFAULT_NOTIFICATION_PREFERENCES.dispute_resolved,
        system:
            typeof source.system === 'boolean'
                ? source.system
                : DEFAULT_NOTIFICATION_PREFERENCES.system,
    };
}

export async function getPreferences(uid: string): Promise<UserPreferences> {
    const snap = await getDoc(doc(db, PREFERENCES, uid));
    if (!snap.exists()) {
        return {
            ...DEFAULT_PREFERENCES,
            uid,
            notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
        };
    }
    const data = snap.data() as Record<string, unknown>;
    return {
        uid,
        notifications: mergeNotificationPrefs(data.notifications),
        updatedAt: tsMs(data.updatedAt),
    };
}

export async function setNotificationPreference(
    uid: string,
    kind: NotificationKind,
    value: boolean,
): Promise<void> {
    await setDoc(
        doc(db, PREFERENCES, uid),
        {
            uid,
            [`notifications.${kind}`]: value,
            updatedAt: serverTimestamp(),
        },
        { merge: true },
    );
}

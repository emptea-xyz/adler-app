import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { NotificationKind } from '@/lib/types/notification';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    DEFAULT_PREFERENCES,
    type NotificationPreferences,
    type UserPreferences,
} from '@/lib/types/preferences';
import { tsMs } from '@/lib/utils/firestoreTimestamp';

const PREFERENCES = 'preferences';

const KINDS: NotificationKind[] = [
    'bounty_submission_received',
    'bounty_won',
    'bounty_lost',
    'bounty_expired_refund',
    'bounty_hidden_by_reports',
    'group_join_approved',
    'group_join_rejected',
    'system',
];

function mergeNotificationPrefs(value: unknown): NotificationPreferences {
    const source =
        value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : {};
    const out = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    for (const kind of KINDS) {
        if (typeof source[kind] === 'boolean') out[kind] = source[kind] as boolean;
    }
    return out;
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

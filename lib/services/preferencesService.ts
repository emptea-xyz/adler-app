import {
    arrayRemove,
    arrayUnion,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
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
    'group_join_requested',
    'group_join_approved',
    'group_join_rejected',
    'group_bounty_new',
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
    const mutedGroupsRaw = Array.isArray(data.mutedGroups) ? data.mutedGroups : [];
    return {
        uid,
        notifications: mergeNotificationPrefs(data.notifications),
        mutedGroups: mutedGroupsRaw.filter((g): g is string => typeof g === 'string'),
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

/**
 * Toggle the per-user mute for a single group. Mute suppresses the
 * new-group-bounty push fan-out for this user (see functions/index.js).
 * Uses arrayUnion/arrayRemove so concurrent writes converge. Ensures the
 * preferences doc exists first so the array field has somewhere to land.
 */
export async function setGroupMute(
    uid: string,
    groupId: string,
    muted: boolean,
): Promise<void> {
    const ref = doc(db, PREFERENCES, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(
            ref,
            {
                uid,
                mutedGroups: muted ? [groupId] : [],
                updatedAt: serverTimestamp(),
            },
            { merge: true },
        );
        return;
    }
    await updateDoc(ref, {
        mutedGroups: muted ? arrayUnion(groupId) : arrayRemove(groupId),
        updatedAt: serverTimestamp(),
    });
}

// Stub. Implemented in step 4 (Settings finishing). The default value
// (everything on) is exported now so Cloud Function fan-out logic and
// future UI wiring can reference it without forcing the I/O.

import type {
    NotificationKind,
} from '@/lib/types/notification';
import {
    DEFAULT_PREFERENCES,
    type UserPreferences,
} from '@/lib/types/preferences';

const NOT_IMPLEMENTED = (fn: string) =>
    new Error(`preferencesService.${fn} is not implemented yet (step 4).`);

export async function getPreferences(uid: string): Promise<UserPreferences> {
    // Eager fallback so the read path is at least correct (the Cloud
    // Function does the same: missing doc = all kinds enabled).
    return { ...DEFAULT_PREFERENCES, uid };
}

export async function setNotificationPreference(
    _uid: string,
    _kind: NotificationKind,
    _value: boolean,
): Promise<void> {
    throw NOT_IMPLEMENTED('setNotificationPreference');
}

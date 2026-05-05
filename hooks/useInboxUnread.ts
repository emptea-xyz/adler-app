import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@/contexts/UserContext';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';

/**
 * True when the user's `latestActivityAt` (server-bumped by Cloud Function
 * triggers) is more recent than the last time we recorded the user opening
 * the Inbox tab. The "last seen" timestamp lives in AsyncStorage — per-device
 * convenience, not a Firestore field.
 *
 * `markSeen()` writes the current time to storage. Call from the Inbox tab's
 * `useFocusEffect`.
 */
export function useInboxUnread(): { unread: boolean; markSeen: () => Promise<void> } {
    const { profile } = useUser();
    const [lastSeen, setLastSeen] = useState<number>(0);

    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SEEN_INBOX_AT)
            .then((v) => {
                if (cancelled) return;
                const parsed = v ? Number(v) : 0;
                setLastSeen(Number.isFinite(parsed) ? parsed : 0);
            })
            .catch(() => null);
        return () => {
            cancelled = true;
        };
    }, []);

    const markSeen = useCallback(async () => {
        const now = Date.now();
        setLastSeen(now);
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SEEN_INBOX_AT, String(now)).catch(() => null);
    }, []);

    const latestActivity = profile?.latestActivityAt ?? 0;
    const unread = latestActivity > 0 && latestActivity > lastSeen;

    return { unread, markSeen };
}

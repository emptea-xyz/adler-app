/**
 * Centralized AsyncStorage keys. Single source of truth.
 */
export const STORAGE_KEYS = {
    CACHED_PROFILE: 'cached_profile',
    COLOR_SCHEME: 'user_color_scheme',
    ONBOARDING_SEEN: 'onboarding_seen',
    LAST_SEEN_INBOX_AT: 'last_seen_inbox_at',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

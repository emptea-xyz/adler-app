/**
 * Centralized AsyncStorage keys. Single source of truth.
 */
export const STORAGE_KEYS = {
    CACHED_PROFILE: 'cached_profile',
    COLOR_SCHEME: 'user_color_scheme',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

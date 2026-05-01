/**
 * Centralized AsyncStorage keys. Single source of truth.
 */
export const STORAGE_KEYS = {
    CACHED_PROFILE: 'cached_profile',
    ACCENT_COLOR: 'user_accent_color_v2',
    COLOR_SCHEME: 'user_color_scheme',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

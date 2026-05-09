/**
 * Centralized AsyncStorage keys. Single source of truth.
 */
export const STORAGE_KEYS = {
    CACHED_PROFILE: 'cached_profile',
    COLOR_SCHEME: 'user_color_scheme',
    ONBOARDING_SEEN: 'onboarding_seen',
    LAST_SEEN_INBOX_AT: 'last_seen_inbox_at',
    /** Persisted creator/brand mode choice for ViewModeContext (step 2). */
    VIEW_MODE: 'view_mode',
    /** 24h stale-while-error cache for the SOL/USD price (wallet UI). */
    SOL_USD_CACHE: 'adler.solUsd',
    /**
     * Buy-flow recovery breadcrumbs. Set before the on-chain `fund_service`
     * is signed; cleared after `markOrderPaid` lands. The boot-time
     * RecoverPendingOrders job (step 4) replays any leftover entries.
     */
    PENDING_ORDERS: 'adler.pendingOrders',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

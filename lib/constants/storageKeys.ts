/**
 * Centralized AsyncStorage keys. Single source of truth.
 */
export const STORAGE_KEYS = {
  CACHED_PROFILE: 'cached_profile',
  COLOR_SCHEME: 'user_color_scheme',
  ONBOARDING_SEEN: 'bounty.onboardingSeen',
  PUSH_PREPROMPT_SEEN: 'push_preprompt_seen',
  LAST_SEEN_INBOX_AT: 'last_seen_inbox_at',
  /** 24h stale-while-error cache for the SOL/USD price (wallet UI). */
  SOL_USD_CACHE: 'adler.solUsd',
} as const;

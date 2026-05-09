/**
 * Canonical Adler accent palette — pulled 1:1 from the Figma file
 * (collection: Tailwind › `accent/*`).
 *
 * Use these for category chips, status pills, illustrative highlights,
 * and any place a brand accent is required. For neutral surfaces use
 * the `theme[N]` tokens from `useTheme()`. For destructive actions use
 * `#DC143C`. Reach into `TailwindColors` only when no `Accent` token fits.
 */
export const Accent = {
  pink: '#ff0088',
  cyan: '#00d4ff',
  lime: '#4cd900',
  orange: '#ff5900',
  sable: '#f1c917',
} as const;

export type AccentName = keyof typeof Accent;

/** Ordered list, matches the Figma swatch order in the design file. */
export const ACCENT_NAMES: readonly AccentName[] = [
  'pink',
  'cyan',
  'lime',
  'orange',
  'sable',
] as const;

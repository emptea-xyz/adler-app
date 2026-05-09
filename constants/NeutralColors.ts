/**
 * Theme-invariant neutrals — for foreground contrast over brand or status
 * colors that themselves don't flip with system scheme.
 *
 * Use case: a `<Check>` icon over a `Status.success` (#10b981) background.
 * The bg stays green in both light and dark mode, so the icon must stay
 * white in both — using `theme[50]` would invert it to near-black on dark
 * mode and ruin contrast.
 *
 * Do NOT use these for theme-aware surfaces (root backgrounds, neutral
 * fills) — that's what `theme[50]` / `theme[950]` are for.
 */
export const Neutral = {
  white: '#ffffff',
  black: '#000000',
  /** Slightly off-white, matches `theme[50]` light-mode value. */
  whiteSoft: '#fafafa',
  /** Slightly off-black, matches `theme[950]` light-mode value. */
  blackSoft: '#0a0a0a',
} as const;

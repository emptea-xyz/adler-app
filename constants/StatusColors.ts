/**
 * Semantic status palette — for success / error / warning / info states.
 *
 * Distinct from `Accent` (brand-accent palette, used for category chips,
 * illustrative highlights, etc.). Status colors must NEVER be swapped for
 * brand accents — a green checkmark and a brand-lime chip serve different
 * functions even when the hue rhymes.
 *
 * For irreversible destructive actions use the canonical hex `#DC143C`
 * directly. It is intentionally outside this palette to keep the "you
 * are about to lose data" signal visually distinct from a generic error.
 */
export const Status = {
  success: '#10b981',
  error: '#f43f5e',
  warning: '#f97316',
  info: '#0ea5e9',
} as const;

export type StatusName = keyof typeof Status;

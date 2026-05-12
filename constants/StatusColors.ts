/**
 * Semantic status palette — for success / error / warning / info states.
 *
 * Distinct from the brand sky accent (`TailwindColors.sky`, used for
 * category chips and illustrative highlights). Status colors must NEVER be
 * swapped for the brand accent — a green checkmark and a sky-tinted chip
 * serve different functions.
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

/**
 * Canonical destructive crimson — used for irreversible actions (sign out,
 * delete account, etc.). Intentionally outside `Status` to keep "you are
 * about to lose data" visually distinct from a generic error state.
 */
export const DESTRUCTIVE = '#DC143C';

/**
 * Number formatting utilities for displaying large numbers in compact form.
 */

/**
 * Formats large numbers to k/M notation.
 * - 1,000,000+ → divide by 1M, 1 decimal place, remove .0, append 'M'
 * - 1,000+ → divide by 1k, append 'k'
 * - Under 1,000 → return as string
 */
export const formatLargeNumber = (num: number): string => {
  if (num >= 1_000_000) {
    const millions = num / 1_000_000;
    const formatted = millions.toFixed(1);
    // Remove .0 for whole numbers
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'M' : formatted + 'M';
  }
  if (num >= 1_000) {
    const thousands = num / 1_000;
    const formatted = thousands.toFixed(0);
    return formatted + 'k';
  }
  return num.toString();
};

/**
 * Formats a SOL amount with up to 3 decimal places. Strips trailing zeros
 * and a trailing decimal point — whole numbers render without a decimal.
 *
 *   formatSol(1)        === '1'
 *   formatSol(1.5)      === '1.5'
 *   formatSol(1.234)    === '1.234'
 *   formatSol(1.2345)   === '1.235'
 *   formatSol(0)        === '0'
 *   formatSol(0.001)    === '0.001'
 *   formatSol(100.5)    === '100.5'
 */
export const formatSol = (sol: number): string => {
  if (!Number.isFinite(sol)) return '—';
  return parseFloat(sol.toFixed(3)).toString();
};

/**
 * Splits a SOL amount into a bold whole part and a muted fractional part
 * for the hero balance display. Always shows two fractional digits when the
 * value is zero (`0` / `00`); for non-zero values, 4 fractional digits with
 * trailing zeros preserved so the display doesn't jitter.
 *
 *   formatSolParts(0)        === { whole: '0', decimal: '00' }
 *   formatSolParts(1)        === { whole: '1', decimal: '0000' }
 *   formatSolParts(1.5)      === { whole: '1', decimal: '5000' }
 *   formatSolParts(1234.567) === { whole: '1,234', decimal: '5670' }
 */
export const formatSolParts = (sol: number): { whole: string; decimal: string } => {
  if (!Number.isFinite(sol)) return { whole: '—', decimal: '' };
  const isZero = sol === 0;
  const fixed = sol.toFixed(isZero ? 2 : 4);
  const [wholeRaw, decimalRaw = ''] = fixed.split('.');
  const whole = Number(wholeRaw).toLocaleString('en-US');
  return { whole, decimal: decimalRaw };
};

/**
 * Strict SOL amount parser. Accepts both `.` and `,` as decimal separator
 * (iOS `decimal-pad` shows `,` in DE/FR/CH locales). Returns null for any
 * malformed input — `parseFloat` quirks like `"1abc" → 1` are rejected.
 */
export const parseSolAmount = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

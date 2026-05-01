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

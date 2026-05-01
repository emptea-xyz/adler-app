/**
 * Scale utilities for mapping data values to pixel coordinates.
 */

/** Format a Y-axis value with just enough decimals to distinguish ticks. */
export function smartLabel(value: number, min: number, max: number): string {
  const range = Math.abs(max - min);
  let decimals = 0;
  if (range < 1) decimals = 2;
  else if (range < 10) decimals = 1;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}


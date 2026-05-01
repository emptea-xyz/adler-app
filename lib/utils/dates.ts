/** Extract "YYYY-MM-DD" date string from a Date object. */
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** Format a Date as "DD.MM.YYYY". Universal full-date format used everywhere. */
export function formatDisplayDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
}

/** Format a Date as "DD.MM" — shortened universal format (no year). */
export function formatShortDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

/** Format a Date as a short active label, e.g. "05.01". Alias for formatShortDate. */
export function formatActiveLabel(date: Date): string {
  return formatShortDate(date);
}

export interface ChartDataPoint {
  label: string;
  value: number;
  activeLabel?: string;
}

/**
 * Aggregate a date-keyed numeric map into chart data points.
 * Uses daily buckets for ranges <= 30 days, weekly buckets for longer ranges.
 */
export function aggregateByRange(
  byDate: Record<string, number>,
  rangeDays: number,
): ChartDataPoint[] {
  const now = new Date();
  const data: ChartDataPoint[] = [];

  if (rangeDays <= 30) {
    for (let i = rangeDays - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = toDateString(date);
      data.push({
        label: i % 5 === 0 ? formatShortDate(date) : "",
        value: Math.round(byDate[dateStr] || 0),
        activeLabel: formatActiveLabel(date),
      });
    }
  } else {
    let weekIndex = 0;
    for (let i = rangeDays - 1; i >= 0; i -= 7) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i);
      let weekTotal = 0;
      for (let j = 0; j < 7 && i - j >= 0; j++) {
        const d = new Date(now);
        d.setDate(d.getDate() - (i - j));
        weekTotal += byDate[toDateString(d)] || 0;
      }
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      data.push({
        label: weekIndex % 4 === 0 ? formatShortDate(weekStart) : "",
        value: Math.round(weekTotal),
        activeLabel: `${formatActiveLabel(weekStart)} \u2013 ${formatActiveLabel(weekEnd)}`,
      });
      weekIndex++;
    }
  }
  return data;
}

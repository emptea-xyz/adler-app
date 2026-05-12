/** Extract "YYYY-MM-DD" date string from a Date object. */
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** Compact relative-time label — "5h ago", "2d ago", "just now". Used on the
 *  Browse feed meta line. */
export function formatRelative(timestampMs: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestampMs);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

/** Compact remaining-time label for a future timestamp — "in 28d", "in 4h",
 *  "soon" (<1 min), or "expired" once the timestamp has already passed. */
export function formatRemaining(timestampMs: number, now: number = Date.now()): string {
  const diff = timestampMs - now;
  if (diff <= 0) return "expired";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "soon";
  const min = Math.floor(sec / 60);
  if (min < 60) return `in ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `in ${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `in ${day}d`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `in ${wk}w`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `in ${mo}mo`;
  return `in ${Math.floor(day / 365)}y`;
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

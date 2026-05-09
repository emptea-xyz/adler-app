import { Timestamp } from "firebase/firestore";

// Coerce whatever Firestore handed us into milliseconds. Read paths see a
// `Timestamp` after a server round-trip, but a freshly-written doc still
// in the local cache may surface as a `Date` or raw number.
export function tsMs(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}

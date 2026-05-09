// Mirror of adler-website/lib/types/review.ts. Source of truth: the
// `match /reviews/{reviewId}` block in adler-app/firestore.rules.
//
// Whitepaper §7 — four axes, weighted by deal size:
//   overall = Σ(meanOfAxes(r) × r.amountSol) / Σ(r.amountSol)
//   perAxis[a] = Σ(r.axes[a] × r.amountSol) / Σ(r.amountSol)
//
// amountSol + listingId are denormalized on each review at write time and
// pinned to the parent order by the rule, so aggregates run on the reviews
// collection alone.

export const RATING_AXES = [
  "scope",
  "communication",
  "timeliness",
  "quality",
] as const;

export type RatingAxis = (typeof RATING_AXES)[number];

export type RatingAxes = Record<RatingAxis, number>;

export interface Review {
  /** Doc id is `${orderId}_${reviewerId}` — deterministic per the rule. */
  id: string;
  orderId: string;
  reviewerId: string;
  revieweeId: string;
  axes: RatingAxes;
  comment: string;
  /** Weight for the deal-size-weighted aggregate, frozen from the order. */
  amountSol: number;
  /** Listing the order was placed against — drives per-listing aggregates. */
  listingId: string;
  createdAt: number;
}

export const RATING_AXIS_LABEL: Record<RatingAxis, string> = {
  scope: "Scope adherence",
  communication: "Communication",
  timeliness: "Timeliness",
  quality: "Quality",
};

export const RATING_AXIS_HINT: Record<RatingAxis, string> = {
  scope: "Did the work match what was agreed?",
  communication: "Responsive, clear, professional?",
  timeliness: "Delivered on time?",
  quality: "Final output worth what was paid?",
};

export const COMMENT_MAX = 500;

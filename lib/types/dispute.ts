// Mirror of adler-website/lib/types/dispute.ts. Source of truth: the
// `match /disputes/{disputeId}` block in adler-app/firestore.rules.
//
// Whitepaper §9 — three outcomes (release_to_creator, refund_to_brand,
// split). v1 records the resolution but doesn't move SOL on-chain; the
// Anchor program in adler-program enforces fund transfers later.
//
// Doc id == orderId — one dispute per order. Second filing race is
// auto-rejected (falls under the rule's update branch, arbiter-only).

export type DisputeStatus = "open" | "resolved";

export type DisputeOutcome =
  | "release_to_creator"
  | "refund_to_brand"
  | "split";

export type DisputeFiledBy = "buyer" | "seller";

export interface Dispute {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  threadId: string;
  filedBy: DisputeFiledBy;
  reason: string;
  status: DisputeStatus;
  outcome: DisputeOutcome | null;
  outcomeNote: string;
  splitPercentToCreator: number | null;
  resolvedBy: string | null;
  resolvedAt: number;
  amountSol: number;
  createdAt: number;
  updatedAt: number;
}

export const REASON_MAX = 2000;
export const OUTCOME_NOTE_MAX = 2000;

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  open: "Open",
  resolved: "Resolved",
};

export const DISPUTE_OUTCOME_LABEL: Record<DisputeOutcome, string> = {
  release_to_creator: "Release to creator",
  refund_to_brand: "Refund to brand",
  split: "Split",
};

/**
 * Outcomes that imply on-chain fund movement we can't perform yet (no
 * escrow program for refund / split). UI displays a "Settlement pending"
 * badge for these until the Anchor program ships those flows.
 */
export const PENDING_SETTLEMENT: Record<DisputeOutcome, boolean> = {
  release_to_creator: false, // funds already with seller in interim flow
  refund_to_brand: true,
  split: true,
};

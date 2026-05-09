// Mirror of adler-website/lib/types/order.ts. Source of truth: the
// `match /orders/{orderId}` block in adler-app/firestore.rules.
//
// State machine:
//   pending → paid       (buyer claims payment + provides txSignature)
//   pending → failed     (buyer aborts)
//   paid    → delivered  (seller marks delivered)
//   delivered → complete (buyer confirms receipt)
//
// Update is restricted to `affectedKeys.hasOnly(['status','txSignature',
// 'updatedAt'])`, so denormalized snapshots are write-at-create-or-never.
// `txSignature` is append-only.
//
// Under the v1 escrow path, `txSignature` holds the `fund_service` sig.
// `submit_delivery` and `approve_release` sigs live on the corresponding
// message docs (escrowTxSignature) — see lib/types/thread.ts.

export type OrderStatus =
  | "pending"
  | "paid"
  | "delivered"
  | "complete"
  | "failed";

export type OrderType = "service" | "gig";

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  status: OrderStatus;
  txSignature: string | null;
  amountSol: number;
  /** Protocol fee snapshot in SOL. 0 when the lamport floor rounds to zero. */
  feeSol: number;
  /** Hex-encoded sha256(orderId). Null on legacy direct-transfer orders. */
  contractId32: string | null;
  /** Base58 escrow PDA. Null on legacy direct-transfer orders. */
  escrowPda: string | null;
  type: OrderType;
  listingId: string;
  // Denorm — populated at create time, tolerated to be stale.
  listingTitle: string | null;
  buyerHandle: string | null;
  buyerDisplayName: string | null;
  sellerHandle: string | null;
  sellerDisplayName: string | null;
  createdAt: number;
  updatedAt: number;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  delivered: "Delivered",
  complete: "Complete",
  failed: "Failed",
};

// Mirror of adler-website/lib/types/notification.ts. Source of truth:
// the `match /notifications/{notificationId}` block in
// adler-app/firestore.rules.
//
// Server-only writer: clients can read their own (recipientId == auth.uid)
// and flip the `read` flag to true. Cloud Functions own creation; the
// emitNotification helper in adler-app/functions/index.js is the single
// upstream call site.

export type NotificationKind =
  | "application_received"
  | "application_decided"
  | "order_state"
  | "thread_message"
  | "dispute_filed"
  | "dispute_resolved"
  | "system";

export interface NotificationRefs {
  orderId?: string;
  threadId?: string;
  applicationId?: string;
  listingId?: string;
  disputeId?: string;
}

export interface AdlerNotification {
  id: string;
  recipientId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Deep-link target — clicking the row both navigates and marks read. */
  href: string;
  read: boolean;
  refs: NotificationRefs;
  createdAt: number;
}

// Mirror of adler-website/lib/types/thread.ts. Source of truth: the
// `match /threads/{threadId}` and `match /threads/.../messages/{messageId}`
// blocks in adler-app/firestore.rules.
//
// Threads are top-level (not subcollections under gigApplications/orders) so
// the inbox can run a single `participants array-contains` query that spans
// both kinds. Each thread is keyed deterministically by (kind, parentId) —
// see threadIdFor() in threadsService.ts.

export type ThreadKind = "application" | "order";

export type MessageKind =
  | "text"
  | "deliverable"
  | "revision_request"
  | "approval"
  | "system";

export interface ParticipantSnapshot {
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Thread {
  id: string;
  kind: ThreadKind;
  parentId: string;
  parentTitle: string | null;
  /** Always exactly two uids. */
  participants: string[];
  participantSnapshots: Record<string, ParticipantSnapshot>;
  lastMessageAt: number;
  lastMessagePreview: string;
  lastMessageSenderId: string | null;
  /** Per-uid unread count. Maintained by an onMessageCreate Cloud Function. */
  unreadCount: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  kind: MessageKind;
  body: string;
  /** Storage download URLs (≤5). */
  attachments: string[];
  createdAt: number;
  /**
   * Base58 signature of the on-chain ix that triggered this message — only
   * set on `deliverable` (submit_delivery) and `approval` (approve_release)
   * messages. Lives here rather than on the order doc because the order-
   * update rule blocks adding fields after create.
   */
  escrowTxSignature: string | null;
  escrowTxConfirmedAt: number | null;
}

export const MESSAGE_BODY_MAX = 2000;
export const MESSAGE_PREVIEW_MAX = 120;
export const MESSAGE_ATTACHMENTS_MAX = 5;
export const REVISION_CAP = 2;

export const MESSAGE_KIND_LABEL: Record<MessageKind, string> = {
  text: "Message",
  deliverable: "Deliverable",
  revision_request: "Revision request",
  approval: "Approval",
  system: "System",
};

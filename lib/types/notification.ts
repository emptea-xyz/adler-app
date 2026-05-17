// Mirror of `notifications/{id}` Firestore doc shape. Server-only writes
// (Cloud Functions); clients read own + flip `read` flag.

export type NotificationKind =
  | 'bounty_submission_received'
  | 'bounty_won'
  | 'bounty_lost'
  | 'bounty_expired_refund'
  | 'bounty_hidden_by_reports'
  | 'group_join_requested'
  | 'group_join_approved'
  | 'group_join_rejected'
  | 'group_bounty_new'
  | 'system';

export interface NotificationRefs {
  bountyId?: string;
  submissionId?: string;
  groupId?: string;
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

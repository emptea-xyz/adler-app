// Mirror of `preferences/{uid}`. Default (no doc) === "everything on".

import type { NotificationKind } from '@/lib/types/notification';

export type NotificationPreferences = Record<NotificationKind, boolean>;

export interface UserPreferences {
  uid: string;
  notifications: NotificationPreferences;
  updatedAt: number;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  bounty_submission_received: true,
  bounty_won: true,
  bounty_lost: true,
  bounty_expired_refund: true,
  bounty_hidden_by_reports: true,
  group_join_approved: true,
  group_join_rejected: true,
  system: true,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  uid: '',
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  updatedAt: 0,
};

export interface NotificationKindGroup {
  label: string;
  description: string;
  kinds: { kind: NotificationKind; label: string; description: string }[];
}

export const NOTIFICATION_KIND_GROUPS: NotificationKindGroup[] = [
  {
    label: 'Bounties',
    description: 'Activity on bounties you posted or submitted to.',
    kinds: [
      {
        kind: 'bounty_submission_received',
        label: 'New submissions',
        description: 'Pings you when someone submits to your bounty.',
      },
      {
        kind: 'bounty_won',
        label: 'You won',
        description: 'Pings you when your submission wins a bounty.',
      },
      {
        kind: 'bounty_lost',
        label: 'Submission rejected',
        description: 'Pings you when your submission fails verification or loses to another.',
      },
      {
        kind: 'bounty_expired_refund',
        label: 'Bounty expired',
        description: 'Pings you when an open bounty expires and the escrow refunds.',
      },
      {
        kind: 'bounty_hidden_by_reports',
        label: 'Bounty hidden',
        description: 'Pings you when your bounty is hidden after community reports.',
      },
    ],
  },
  {
    label: 'Groups',
    description: 'Membership decisions on groups you requested to join.',
    kinds: [
      {
        kind: 'group_join_approved',
        label: 'Join request approved',
        description: 'Pings you when a group admin lets you in.',
      },
      {
        kind: 'group_join_rejected',
        label: 'Join request rejected',
        description: 'Pings you when a group admin declines your request.',
      },
    ],
  },
  {
    label: 'System',
    description: 'Adler-level announcements. Rare; muting is generally fine.',
    kinds: [
      {
        kind: 'system',
        label: 'System messages',
        description: 'Adler-level lifecycle pings and policy notices.',
      },
    ],
  },
];

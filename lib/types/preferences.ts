// Mirror of adler-website/lib/types/preferences.ts. Source of truth: the
// `match /preferences/{uid}` block in adler-app/firestore.rules.
//
// Default (no doc) === "everything on". preferencesService.getPreferences
// falls back to DEFAULT_PREFERENCES on a 404, and the Cloud Function's
// emitNotification helper treats a missing doc as "all kinds enabled".

import type { NotificationKind } from "@/lib/types/notification";

export type NotificationPreferences = Record<NotificationKind, boolean>;

export interface UserPreferences {
  uid: string;
  notifications: NotificationPreferences;
  updatedAt: number;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  application_received: true,
  application_decided: true,
  order_state: true,
  thread_message: true,
  dispute_filed: true,
  dispute_resolved: true,
  system: true,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  uid: "",
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  updatedAt: 0,
};

// UI grouping for the settings/notifications page. Order = render order.
export interface NotificationKindGroup {
  label: string;
  description: string;
  kinds: { kind: NotificationKind; label: string; description: string }[];
}

export const NOTIFICATION_KIND_GROUPS: NotificationKindGroup[] = [
  {
    label: "Orders",
    description: "Payment, delivery, and approval updates on your contracts.",
    kinds: [
      {
        kind: "order_state",
        label: "Order state changes",
        description:
          "Pings when an order moves between paid, delivered, and complete.",
      },
    ],
  },
  {
    label: "Messages",
    description: "Activity on application + order threads you participate in.",
    kinds: [
      {
        kind: "thread_message",
        label: "New messages",
        description:
          "Pings on every new chat or deliverable in your threads.",
      },
    ],
  },
  {
    label: "Applications",
    description: "Pitch activity on gigs you posted or applied to.",
    kinds: [
      {
        kind: "application_received",
        label: "New applications received",
        description: "Pings brands when a creator applies to one of their gigs.",
      },
      {
        kind: "application_decided",
        label: "Application decisions",
        description:
          "Pings creators when their application is shortlisted, awarded, or closed.",
      },
    ],
  },
  {
    label: "Disputes",
    description: "Arbitration activity on contracts you're a party to.",
    kinds: [
      {
        kind: "dispute_filed",
        label: "Dispute opened",
        description: "Pings the counterparty when a dispute is filed.",
      },
      {
        kind: "dispute_resolved",
        label: "Dispute resolved",
        description: "Pings both parties when an arbiter decides an outcome.",
      },
    ],
  },
  {
    label: "System",
    description: "Adler-level announcements. Rare; muting is generally fine.",
    kinds: [
      {
        kind: "system",
        label: "System messages",
        description: "Adler-level lifecycle pings and policy notices.",
      },
    ],
  },
];

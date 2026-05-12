/**
 * Centralized copy strings for empty states and reusable microcopy.
 * Tone: confident, action-oriented, no jargon. Brand "Adler" preserved
 * verbatim wherever it appears.
 */

export const EMPTY_BROWSE_PUBLIC = {
  title: 'Quiet on the wire',
  description: 'No public bounties open right now. Be the first to post one.',
} as const;

export const EMPTY_BROWSE_GROUPS = {
  title: 'No group bounties',
  description: 'Join a group to see private bounties here.',
} as const;

export const EMPTY_INBOX_POSTED = {
  title: 'No bounties posted',
  description: 'Hit the Create tab to post your first one.',
} as const;

export const EMPTY_INBOX_SUBMITTED = {
  title: 'No submissions yet',
  description: 'Find a bounty in Browse and submit a photo.',
} as const;

export const EMPTY_NOTIFICATIONS = {
  title: 'Quiet on the wire',
  description: 'When something happens on a bounty you posted or solved, it lands here.',
} as const;

export const EMPTY_WALLET_BALANCE = {
  title: 'There is nothing here yet',
  description: 'Deposit SOL to your wallet to get started.',
} as const;

export const EMPTY_WALLET_ACTIVITY = {
  title: 'No activity yet',
  description: 'On-chain transactions for this wallet will show up here.',
} as const;

export const EMPTY_GROUP_BOUNTIES = {
  title: 'No active bounties',
  description: 'When a member posts a group bounty, it shows up here.',
} as const;

export const EMPTY_GROUP_MEMBERS = {
  title: 'No members yet',
  description: 'Add the first member from this group.',
} as const;

export const GROUP_NOT_READY = {
  title: "This group isn't ready yet",
  description:
    'The Adler team is still setting it up. Reach out if you need it sooner.',
  cta: 'Contact the team',
} as const;

export const GROUP_CONTACT_MAILTO = 'mailto:emptea.apps@gmail.com';

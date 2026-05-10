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

export const EMPTY_BOUNTY_SUBMISSIONS = {
  title: 'No submissions yet',
  description: 'Be the first to submit a photo.',
} as const;

export const EMPTY_GROUPS = {
  title: 'No groups yet',
  description: 'Groups gate private bounties to a curated audience.',
} as const;

export const EMPTY_WALLET_BALANCE = {
  title: 'Wallet is empty',
  description: 'On devnet, fund yourself with the Solana CLI to start posting bounties.',
} as const;

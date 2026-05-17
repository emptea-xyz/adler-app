/**
 * Usernames that the platform won't allow users to claim. Mirrors the
 * `usernameNotReserved` helper in firestore.rules — keep both in sync
 * (rule wins; this list is a fast-feedback guard before the network
 * round-trip rejects).
 */
export const RESERVED_USERNAMES = new Set<string>([
    'adler',
    'admin',
    'administrator',
    'support',
    'help',
    'helpdesk',
    'mod',
    'moderator',
    'staff',
    'team',
    'official',
    'system',
    'root',
    'security',
    'abuse',
    'billing',
    'payments',
    'press',
    'careers',
    'jobs',
    'hiring',
    'legal',
    'privacy',
    'terms',
    'about',
    'contact',
    'feedback',
    'bounty',
    'bounties',
    'bug',
    'bugs',
]);

export function isReservedUsername(slug: string): boolean {
    return RESERVED_USERNAMES.has(slug.trim().toLowerCase());
}

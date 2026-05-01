/**
 * Centralized copy strings for empty states, errors, and other reusable
 * microcopy. Keep tone consistent: confident, action-oriented, no jargon.
 */

export const EMPTY_BROWSE = {
    title: 'Quiet on the wire',
    description: 'When creators ship packages and brands post gigs, they land here.',
} as const;

export const EMPTY_INBOX_PURCHASES = {
    title: 'No purchases yet',
    description: 'Buy your first package and it shows up here with the on-chain receipt.',
} as const;

export const EMPTY_INBOX_SALES = {
    title: 'No sales yet',
    description: 'Once a brand buys one of your packages, the order appears here.',
} as const;

export const EMPTY_INBOX_APPLICATIONS = {
    title: 'No applications yet',
    description: 'Pitch a gig from the Browse tab and your applications track here.',
} as const;

export const EMPTY_PACKAGES_BY_SELLER = {
    title: 'No packages yet',
    description: 'Hit the Create tab to publish your first one.',
} as const;

export const EMPTY_GIGS_BY_BRAND = {
    title: 'No gigs yet',
    description: 'Hit the Create tab to post your first brief.',
} as const;

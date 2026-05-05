/**
 * Canonical category enum for packages, gigs, and the Browse filter.
 *
 * IMPORTANT: this list is mirrored in `firestore.rules` (the `category in [...]`
 * checks on `/packages` and `/gigs` create rules). If you add or remove an
 * entry here, update the rules file in the same change and redeploy them.
 */
export const CATEGORIES = [
    'beauty',
    'fitness',
    'health',
    'education',
    'food',
    'lifestyle',
    'general',
] as const;

export type Category = typeof CATEGORIES[number];

export function isCategory(value: string): value is Category {
    return (CATEGORIES as readonly string[]).includes(value);
}

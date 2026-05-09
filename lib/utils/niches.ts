/**
 * Port of adler-website/lib/utils/niches.ts. These suggestions are used by
 * creator setup and later become directory filters.
 */
export const SUGGESTED_NICHES = [
    'fashion',
    'fitness',
    'food',
    'tech',
    'gaming',
    'beauty',
    'travel',
    'lifestyle',
    'music',
    'art',
    'comedy',
    'education',
] as const;

export const NICHE_PATTERN = /^[a-z0-9 -]{1,24}$/;

export function normalizeNiche(raw: string): string {
    return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

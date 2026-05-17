/**
 * Canonical http/https URL regex used by every link-submission code
 * path: client form gate, service-side validator, and a *companion* (not
 * an exact mirror) of the firestore.rules pattern at the bounties-rules
 * file. The rule itself can only do a `matches('^https?://.+')` because
 * rule-lang regex is limited — we use a slightly stricter version here
 * (requires a dot somewhere after the scheme) to catch obvious typos
 * like `https://localhost` before the round-trip.
 *
 * If you tighten the rule, update this file in lockstep.
 */
export const LINK_URL_RE = /^https?:\/\/\S+\.\S+/i;

# Adler — Feature Upgrade (Virality Sprint)

The "roter Faden" — the through-line that turns Adler from a working
bounty marketplace into something that *spreads*. Six features,
sequenced by ROI and dependency. Each has its own dedicated plan
written before implementation starts (`.claude/plans/feature-*.md`).

## Goal

Every payout becomes acquisition. Every shared link recruits a viewer.
Every Browse session feels alive. The app should leak users in its
favor — open loops back into the funnel at the receipts, the share
sheet, the deep link, the home screen.

## Non-goals (in this sprint)

- Referrals / invite codes — high scope, low demo lift
- Streaks for individual users — low first-impression value
- AI-generated brief suggestions — separate research arc
- Push-notification fan-out beyond what already exists

## Phases

### 1. Winner share card — `feature-share-card.md`
**Why first**: standalone, no backend changes, photographs perfectly for
demo. Every settled bounty becomes a shareable poster ("@maru won 2 SOL
on Adler") with a deep link back to the bounty. Renders client-side via
`react-native-view-shot` (or Skia) → native share sheet.

**Scope**: 1 day. New component + share trigger on settle confirmation +
trigger from bounty detail when status = `settled`.

### 2. Total SOL paid out counter — `feature-total-paid.md`
**Why second**: trivial Cloud Function aggregator, gives Browse its
trust glyph in one number. Pairs with phase 1's share card as a backdrop
stat.

**Scope**: half a day. New `stats/global` doc updated by a Firestore
trigger on settle, surfaced as a small KPI on Browse header.

### 3. Live activity ticker — `feature-activity-ticker.md`
**Why third**: makes the Browse screen feel inhabited. Rolling marquee
of recent events ("0.5 SOL bounty just posted", "@x won 1.2 SOL"). High
demo value, low risk — pure UI on top of existing data.

**Scope**: 1 day. New `recentActivity` query (last 20 settle/post
events) + animated marquee component above the feed.

### 4. OG previews for bounty URLs — `feature-og-previews.md`
**Why fourth**: every link shared on Twitter/Telegram unfurls into a
proper preview card. Massive funnel boost for the share work in phase 1.
Requires a public web surface — Cloud Function returning HTML with meta
tags, or a Next.js route if we wire the landing site.

**Scope**: 1 day. Cloud Function `bountyPreview` + Universal Link
config so iOS deep-links resolve cleanly.

### 5. Public submission galleries — `feature-submission-gallery.md`
**Why fifth**: turns each bounty into a portfolio. After settle, all
submissions are viewable (with the winning one pinned). Creators get
discoverability; posters get a record of their bounty's quality.

**Scope**: 1.5 days. Privacy rules pass on `submissions`, gallery view
on bounty detail screen, profile screen pulls a creator's settled
submissions.

### 6. Weekly leaderboards — `feature-leaderboards.md`
**Why last**: highest engineering cost (rolling aggregation), pure
retention play. Ships only if phases 1–5 are clean.

**Scope**: 2 days. Cloud Function rollup + Browse tab subsection +
profile badges for top finishers.

## Sequencing rules

- Ship one phase to `main` end-to-end before starting the next. No
  parallel feature branches.
- Each phase begins with its dedicated plan being written and approved
  before code is touched.
- Each phase ends with: backend deployed (if any), iOS-only verification,
  commit + push.

## Status

| Phase | Status | Plan |
|------|--------|------|
| 1. Winner share card | not started | — |
| 2. Total SOL paid out | not started | — |
| 3. Live activity ticker | not started | — |
| 4. OG previews | not started | — |
| 5. Submission galleries | not started | — |
| 6. Weekly leaderboards | not started | — |

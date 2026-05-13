# Post-funding plan

**Status:** locked behind funding. Do not execute pre-funding. This file
is the master playbook handed to the team on day 1 after a round closes.

## Scope

Everything between "term sheet signed" and "Adler is the way 18–28 year
olds earn money with tasks." Two explicit exclusions:

- **KYC of users.** Deferred. Onramp partners handle their own KYC; we
  don't collect identity docs ourselves at this stage.
- **Cash-out to bank.** Deferred. Winners keep USDC on-chain.

Everything else is in scope below.

---

## A. Product & Engineering

### A1. Mainnet cutover + USDC + Apple Pay (the core unlock)

Devnet kills adoption. The product becomes real on mainnet with
USD-denominated stablecoin amounts that posters fund via Apple Pay.

**Stablecoin:** USDC on Solana mainnet
- Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (Circle, 6 decimals)
- Pinned in `ProtocolConfig` on-chain (fake-mint attack impossible)
- UI shows USD/EUR; SOL only kept as tx-fee dust

**Onramp:** Stripe Crypto Onramp primary, MoonPay fallback
- Stripe — cleanest API, native Apple Pay sheet, KYC by Stripe, lowest fee tier, direct USDC-on-Solana delivery. Apply for Stripe Crypto partner access day 1 (gate is 2–6 weeks).
- MoonPay (`@moonpay/react-native-moonpay-sdk`) — fallback if Stripe gate isn't open. RN SDK, Apple Pay supported, USDC-Solana direct, ~1% higher fee.
- Feature-flag picks the active provider per build.

**Anchor program rewrite (`adler-escrow` v2.0):**

| What | From | To |
|---|---|---|
| Escrow holder | `BountyEscrow` PDA holding lamports | `BountyEscrow` PDA owning a USDC ATA |
| Fund ix | `system_program::transfer` | `token::transfer` (poster ATA → escrow ATA) |
| Settle ix | lamport decrement | `token::transfer` × 2 (winner ATA + treasury ATA) |
| Refund/cancel | lamport refund + close | `token::transfer` back + `token::close_account` on the ATA |
| Config | `fee_treasury: Pubkey` | `fee_treasury: Pubkey` (ATA) + `usdc_mint: Pubkey` |
| Amount | `amount_lamports: u64` | `amount_units: u64` (micro-USDC, 6 dec) |

PDA seed bump again (`bounty_v3`, `bounty_config_v3`) so v1 PDAs are
cleanly orphaned. Fresh program id on mainnet (no upgrade-authority
collision with v1).

**Mobile flow (PostBountySheet funding):**
1. User picks amount in USD ("$10").
2. Check poster's USDC ATA balance.
3. If sufficient → straight to `create_bounty` ix.
4. If not → onramp SDK with `{ walletAddress, currency: 'usdc_sol', fiatAmount, paymentMethod: 'apple_pay' }`. Native Apple Pay sheet appears.
5. Poll ATA balance every 3s for up to 90s; webhook short-circuits via Cloud Function.
6. Once funded → `create_bounty` ix → bounty live.

**SOL-for-fees:** Privy wallet needs ~0.001 SOL for tx fees. On first onramp purchase, multi-asset order: $10 USDC + $0.50 SOL. Both Stripe and MoonPay support this.

**Display layer:** every SOL/lamport string becomes USD/micro-USDC. `formatNumber.usd()` helper; `bountyLamports` → `bountyUnits`; `computeFeeLamports` → `computeFeeUnits`.

**Backend:**
- Firestore: `bounties.amountUnits` (micro-USDC integer). Dual-write during transition; drop `bountyLamports` after.
- Cloud Function `onrampWebhook` — Stripe/MoonPay POSTs purchase completion; flips `fundingTxComplete: true` on the doc so client polling short-circuits.
- `expireBounties` Pass-0 reconcile: checks USDC ATA balance instead of lamports.
- Firestore rules updated: `bountyValidShape` requires `amountUnits > 0`.

**App Store compliance (Guideline 3.1.5(a)):**
- Crypto purchases through licensed third parties (Stripe/MoonPay) are explicitly allowed. Adler is not the seller.
- App Review notes every submission: "In-app crypto purchases route through [provider]. Adler does not custody, exchange, or sell cryptocurrency."
- Do NOT register the funding flow as IAP. Payouts are P2P USDC transfers, not IAP.

### A2. Mainstream features for 18–28 (in priority order)

1. **Categories + geo discovery** — "TikTok content", "user testing", "graphic design", "campus", + "near me" radius for IRL gigs (deliver flyers, mystery shop, photograph a venue). Beats one global feed. Firestore composite indexes on `(category, status, createdAt)` and `(geohash, status)`.
2. **Bounty templates** — preset shells the poster can fork ("30s TikTok of [product]", "5 testimonials at a coffee shop"). Lowers posting friction so a brand can fire 10/day instead of 1/week. Stored as `bountyTemplates/{id}`, curated by admin.
3. **In-thread DM per submission** — Q&A without leaving the app. `threads/{compoundId}` (`<bountyId>_<submitterId>`), messages subcollection, server-only write of system events, App Check enforced. Unread counters via Cloud Function on message create.
4. **Social verification** — link TikTok/Instagram/YouTube handle, fetch follower count via official APIs, badge it on the submission. Posters pick credible creators; creators get inbound. Implementation: OAuth via Privy linked accounts where supported, web-OAuth handoff otherwise.
5. **Recurring bounties** — "post this gig weekly" subscription for brands. Predictable income for top creators = retention. Cloud Function clones the template on a cron; the brand's USDC ATA funds it automatically (one-time Apple Pay top-up covers N weeks).
6. **Camera-first submission UX** — record / upload in one tap, native preview, auto-trim to bounty's max length, in-app trimming. Today's submission flow is a generic media picker — kill that friction. `expo-camera` + `expo-video-trimmer`.
7. **Push notifications expansion** — "new bounty in your category", "you got picked", "your submission was viewed by N people". Beyond today's transactional pushes. Pref toggles in settings.
8. **OG previews + Universal Links** — every shared bounty URL unfurls cleanly on Twitter/Telegram/iMessage. Cloud Function `bountyPreview` returns HTML with meta tags; Universal Link config on iOS resolves directly into the bounty detail screen. Drafted in `feature-og-previews.md` (queue).
9. **Winner share card + share-sheet** — receipt becomes a shareable poster. Drafted in `feature-share-card.md`.
10. **Activity ticker + global counter** — Browse feels inhabited. Drafted in `feature-upgrade.md` phases 2–3.
11. **Submission galleries + portfolios** — settled bounty becomes a public gallery; creator profile pulls all settled submissions. Drafted in `feature-upgrade.md` phase 5.
12. **Leaderboards** — weekly rollup; top earners, top posters, top creators by category. Drafted in `feature-upgrade.md` phase 6.

### A3. Engineering hardening

- **Anchor program audit** — independent firm (OtterSec, Neodyme, or Sec3) before mainnet deploy. Budget $25–40k, 2–3 week turnaround. Non-negotiable.
- **Squads multisig** as upgrade authority on the mainnet program. 2-of-3 keys distributed (founder, CTO, cold backup).
- **Treasury multisig** — protocol fee treasury also behind Squads, never a single key.
- **App Check enforcement** flipped from Monitor → Enforce on all callable functions and the `solanaRpcProxy*` endpoints.
- **Sentry / crash + performance monitoring** — iOS native + JS layer. Privy session id and bounty id as breadcrumbs (no PII).
- **Structured logging** in Cloud Functions — JSON logs, severity levels, request ids correlated across functions.
- **Synthetic monitoring** — Checkly or similar hits `/health` on each function + does a full mainnet RPC round-trip every 5 min.
- **Mainnet Helius plan** — paid tier with priority RPCs, websocket subscriptions, enhanced transaction APIs.
- **Rate-limit + abuse detection** on the RPC proxy — already has per-IP daily cap; add per-wallet caps + sliding window.
- **Backup strategy** — Firestore daily exports to GCS, retained 30 days. Anchor program state can be reconstructed from chain, but we snapshot `ProtocolConfig` weekly to detect tampering.
- **CI** — GitHub Actions: lint + typecheck + Anchor program tests on every PR. EAS submit on tagged releases.
- **Feature flags** — GrowthBook or similar so we can ship code dark and roll new features per cohort.

### A4. Apple ecosystem

- **App Store Connect production listing** — screenshots (use Maestro automation), privacy nutrition label, description copy, keywords, age rating.
- **App Privacy report** — declare data collection: Privy email + Solana wallet address, push tokens, no third-party tracking.
- **TestFlight** — internal track for engineering, external track for ~50 beta users on real $5 bounties for 1 week pre-launch.
- **Universal Links** — `applinks:adler.app` (or final domain) + apple-app-site-association file served from the marketing site.
- **Sign in with Apple** already shipped — keep alongside Google.
- **Apple Search Ads** — small initial budget ($2–5k) for keyword discovery: "earn money", "side hustle", "tasks for money", "tiktok bounty".

### A5. iOS-only sticks; web is the funnel

- **No Android.** Reaffirm in CLAUDE.md and rule files. We focus.
- **Web app stays marketing-only.** `adler.app` landing + waitlist + OG preview rendering + universal-link target. No web-app sign-in. (The existing `adler-website` Next.js project covers this — needs only design polish + the `bountyPreview` endpoint.)

---

## B. Compliance & Legal (excluding user-KYC)

- **Terms of Service** rewritten for production — drafted by counsel. Cover: P2P nature of payouts, no custody, no investment advice, dispute resolution mechanism, jurisdiction (Switzerland or Delaware, decide with legal).
- **Privacy Policy** — GDPR + CCPA compliant. Privy and Firebase as named subprocessors. Data retention: profile data deleted on account deletion (already wired); bounty/submission docs retained for counterparty integrity.
- **GDPR DPA** with Firebase (Google) + Privy + Stripe/MoonPay — execute pre-launch.
- **EU representative** — required for GDPR if no EU establishment. Use a service like Prighter (~€500/yr).
- **VAT on protocol fee** — protocol fee is a B2C service charge. Likely VAT-applicable in EU (MwSt on the 0.5% cut). Decision with accountant: absorb VAT into the fee, or invoice separately. Probably absorb for simplicity; register CH VAT + EU OSS.
- **App Store Review prep document** — single PDF reviewers see: how the app works, where the crypto onramp lives, why bounty payouts aren't IAP, links to onramp providers' Apple-compliance letters.
- **AML at the protocol level** — we don't custody, but the fee treasury receives funds. Quarterly Chainalysis (or similar) scan of incoming flows to the treasury to flag sanctioned addresses; if hit, log + manual review.
- **Trademark filings** — "Adler" wordmark in CH, EU, US.
- **Cookie banner on the marketing site** — required for EU visitors.
- **DMCA agent registration** for the marketing site + in-app reports flow.

---

## C. Marketing & Growth

- **Brand pass** — pro identity: refined logo lockup, brand book, type system (Geist stays as base), color extensions for marketing surfaces (in-app industrial precision stays as-is).
- **Marketing site v2** — current `adler-website` is sparse. Bring to launch-grade: hero, "How it works" for both posters and creators, live ticker pulled from production stats endpoint, founder section, FAQ, waitlist.
- **Content engine** — short-form video from day 1. Repackage demo clips into TikTok/Reels. Team posts 5 pieces/week from launch.
- **Creator seeding** — recruit 50 creators (TikTok/IG, 5–50k followers each) pre-launch. Pay them a $50 onboarding bounty to make a piece of content about Adler. Their followers become the first user cohort.
- **Brand seeding** — recruit 20 small DTC brands (Shopify ~$50k–$1M/yr) to post their first 3 bounties. Free for first 30 days (waive protocol fee). They tweet about Adler when they get content back. Cold outreach + warm intros.
- **Referral mechanism** — v1: shareable invite code on profile, both sides get $1 USDC credit on the new user's first settled bounty. Cloud Function gates the credit (one-time per referee, signed by server, paid from a marketing-pool treasury wallet).
- **PR moment for launch** — coordinate a TechCrunch / Decrypt / The Information drop tied to mainnet day. Pre-brief 2 weeks out.
- **Solana ecosystem moves** — apply for Solana Foundation grant, Phantom integrations (one-click bounty link → Phantom mobile), Helius case study.
- **Analytics stack** — PostHog (self-hostable, EU regions, GDPR-friendly). Track: signup → first bounty viewed → first submission → first settled. Funnel dashboards.
- **A/B testing** — GrowthBook (same flags as feature flags). First A/B: onramp provider (Stripe vs MoonPay), default category on Browse, share-card copy.

---

## D. Operations

- **Customer support** — Intercom or Crisp in-app + a `support@adler.app` inbox. Response SLA: 24h first response, 72h resolution for non-disputes. One support hire by month 3.
- **Dispute queue** — bounty disputes (winner refuses payout, poster won't pick a winner) routed to an in-app queue + a support dashboard. Manual review until volume justifies automation.
- **Status page** — Statuspage.io or self-hosted Better Uptime. Shows: API, RPC proxy, push delivery, onramp providers. Public.
- **Internal docs** — Notion workspace: runbooks (mainnet redeploy, treasury rotation, key compromise, App Check rotation), on-call playbook, FAQ, deal log.
- **On-call** — founder + CTO share PagerDuty rotation for first 6 months. Critical alerts: function error rate > 1%, RPC proxy 5xx > 0.5%, payout settlement failure rate > 0.1%.
- **Quarterly disaster drill** — simulate: (1) lost upgrade key, (2) compromised proxy API key, (3) onramp partner outage. Document recovery path; rehearse.

---

## E. Team & Hiring

Order of hires assuming a $1–3M seed:

1. **Senior Solana engineer** (Anchor + token program experience). Owns mainnet rewrite + audit. Month 1.
2. **Senior mobile engineer** (Expo / RN, Apple Pay + native module experience). Owns onramp integration + camera-first submission. Month 1.
3. **Designer** (product + brand). Owns marketing site v2 + App Store assets + the industrial-precision in-app system. Month 2.
4. **Growth / content lead** — 5 pieces of video content/week, manages creator + brand seeding. Month 2.
5. **Customer support** (part-time → full-time when volume justifies). Month 3.
6. **Compliance / ops generalist** — handles ToS, VAT, App Store relations, vendor procurement. Fractional fine to start. Month 3.

Founder stays in CEO + product role. CTO codes through audit and TestFlight.

---

## F. Timeline (post-funding close = day 0)

Parallelisable workstreams:

| Week | Engineering | Compliance | Growth |
|---|---|---|---|
| 0–1 | Hire #1, #2 in flight; Stripe Crypto partner app submitted | ToS + Privacy drafts to counsel | Brand pass kickoff |
| 1–2 | Anchor v2 code complete on localnet | Subprocessor DPAs in flight | Marketing site v2 wireframes |
| 2–3 | Audit firm engaged; devnet smoke for v2 | App Store review prep doc | Creator seeding outreach |
| 3–5 | Audit window | VAT registrations CH + EU | Brand seeding outreach |
| 5 | Mainnet deploy + Squads handoff | App Store production submission | Marketing site v2 ships |
| 5–6 | TestFlight external w/ 50 users on $5 bounties | App Store review (5–7d) | Pre-brief press 2 weeks out |
| 6–7 | Bug bash; observability dialed in | — | Press embargo lifts on launch day |
| 7 | **Public mainnet launch** | — | TikTok content engine running |
| 8–12 | A2 features ship one-per-week | — | Referral v1, A/B onramp providers |

Critical path: Stripe Crypto partner gate (2–6 weeks) and Anchor audit (3 weeks). Run in parallel.

**T-7 weeks** from funding close to public mainnet, assuming Stripe gate clears in parallel. **T-12 weeks** if Stripe gates and we ship with MoonPay first.

---

## Open questions (decide at funding close)

- Jurisdiction of incorporation (CH AG vs Delaware C-Corp). Tax, fundraising, App Store.
- Bounty cap on funding (start at $100/post until abuse patterns are seen).
- Refund window: keep 30d submission + 90d review (120d capital trapped) or shrink to 30d total for friendlier mainnet UX.
- Mainnet fee rate: 0.5% (current) or 1% (more headroom, still cheap vs Upwork's 10%).
- Domain — `adler.app` vs `adler.so` vs `useadler.com`. Trademark check first.
- Onramp coverage geography — Stripe Crypto isn't in every country yet; map markets where we can vs can't accept Apple Pay → USDC and gate accordingly.

---

## Explicitly out of scope

- **User KYC** — onramp partners handle their own; we don't collect ID docs.
- **Bank cash-out for winners** — winners keep USDC on-chain.
- **Android client.**
- **Multi-chain support.**
- **Native browser-extension wallet support** — Privy embedded only.
- **Fiat-denominated bounties.** Bounties are USDC-denominated; the UI shows USD as a display convenience, but the unit on chain is USDC.

# Adler Mobile — Plan to a Finished App

> Companion to [MOBILE_HANDOFF.md](MOBILE_HANDOFF.md). The handoff doc is the
> spec from the web team; this doc is our execution plan from current state
> all the way to a shipped, mainnet, App-Store-grade product.
>
> The plan has four detailed phases (1–4) for v1 parity — that's the bulk
> of the engineering work and most of what's specified in the handoff —
> followed by three less-granular phases (5–7) for on-chain completion,
> production launch, and post-launch iteration. Update **Status** +
> **Decisions log** as we go.

## Context

The mobile app moved onto the v1 Firestore schema in step 1 — `services/`
collection, `creatorProfile`/`brandProfile` sub-objects, `isCreator` /
`isBrand` denorm flags, deterministic application + review IDs. The
deployed rules in [firestore.rules](firestore.rules) and Cloud Functions
in [functions/index.js](functions/index.js) are the contract; mobile
catches up over four steps. **Do not redeploy backend from mobile-side.**

Beyond v1 parity, the on-chain Anchor program in `../adler-program` still
has flows to ship (gig escrow, refunds, on-chain disputes, rep cards) —
those land on web first and mobile mirrors them. Mainnet cutover, App
Store submission, and any post-launch iteration round out the path.

## Status

**Phase A — v1 parity (the four detailed steps below):**
- **Step 1: ✅ Complete** — commit `c504b6a` (62 files, +5712 / −1342). Typecheck + lint clean. Smoke-test against `emptea-adler` is the next gate before step 2.
- **Step 2: ⏳ Next**
- **Step 3: ⏳ Pending**
- **Step 4: ⏳ Pending**

**Phase B — closes (on-chain catchup):** ⏳ Pending — depends on web/Anchor team shipping the missing program flows.

**Phase C — production launch:** ⏳ Pending — gated on Phase A acceptance + external escrow audit.

**Phase D — post-launch iteration:** ⏳ Pending — driven by usage data after launch.

---

## Step 1 — v1 schema migration *(done)*

Goal: every Firestore write the mobile makes is accepted by the deployed rules.

**Landed in `c504b6a`:**
- 10 type files in [lib/types/](lib/types/) ported verbatim from `adler-website/lib/types/`
- 8 v1 services + 6 step-3/4 stubs in [lib/services/](lib/services/)
- 5 legacy services deleted (`packageService`, `gigService`, `applicationService`, `orderService`, `reviewService`)
- [profileService.ts](lib/services/profileService.ts) rewritten for `creatorProfile`/`brandProfile`/denorms/`dmContact`/country
- Storage uploads split: avatar (existing) + `listingMediaUploadService` + `messageMediaUploadService`
- [escrow.ts](lib/constants/escrow.ts) constants added; [featureGates](lib/constants/featureGates.ts), [storageKeys](lib/constants/storageKeys.ts), [queryKeys](lib/constants/queryKeys.ts) extended (with legacy compat shims)
- [package/[id].tsx](app/(home)/) renamed → [service/[id].tsx](app/(home)/service/[id].tsx); Stack registration updated
- [paymentService](lib/services/paymentService.ts) keeps the legacy direct-transfer path but writes v1 order shapes (gets replaced with on-chain escrow in step 4)
- ~20 consumer screens / sheets retargeted

**Smoke-test acceptance signals (do these before step 2):**
1. Sign in on a real device against `emptea-adler` → fresh `profiles/{uid}` doc has `isCreator: false`, `isBrand: false`, `creatorProfile: null`, `brandProfile: null`, no rule rejections in console.
2. Pick a role on `/role-select` (or via [RoleSwitchSheet](components/features/role/RoleSwitchSheet.tsx)) → corresponding `isCreator` or `isBrand` flips to `true`, sub-profile populated, denorm in lockstep.
3. Browse loads — `services/` and `gigs/` queries return data without rule errors.
4. Settings → Profile basic edit (display name + bio) round-trips via `updateProfileBasics`.

---

## Step 2 — Onboarding + read-only marketplace + profile setup + push token *(next)*

Goal: a fresh user signs in → onboarding → lands in a feed → fills in at least one side of their profile → device receives push notifications.

**Decisions taken:**
- ✅ **Delete `app/(auth)/role-select.tsx`** and rely on `<ProfileGate>` for enforcement. The web does the same.

**Build order (one bulk commit):**

1. **`<ProfileGate>` component** at `components/base/ProfileGate.tsx` with `require="any" | "creator" | "brand"`. Wraps `(home)/(tabs)/_layout.tsx` and any role-locked route. Renders behind a blurred dialog when the required side isn't set up; sidebar-equivalent stays interactive so the user can sign out.
2. **`ViewModeContext`** at `contexts/ViewModeContext.tsx` — `{ viewMode, setViewMode, availableModes }`. Snaps to the available mode if only one side is set up; persists user preference via AsyncStorage `VIEW_MODE`. Replaces every `viewModeFor(profile)` call site.
3. **Delete `role-select.tsx`** and the routing branch in [app/index.tsx](app/index.tsx); update [(auth)/_layout.tsx](app/(auth)/_layout.tsx) accordingly. Routing becomes: no user → sign-in; first-time → intro → browse (gated); returning → browse (gated).
4. **Onboarding rewrite** — replace [intro.tsx](app/(auth)/intro.tsx) slides with the §6 copy (Welcome / Embedded wallet / Devnet test SOL). Persist `onboarding_seen` via AsyncStorage. Already half-wired; just swap copy.
5. **Push token registration** — extend [pushService.ts](lib/services/pushService.ts) so first authenticated boot writes `profiles/{uid}.pushToken`. Add `Notifications.addPushTokenListener` for rotation. UserContext already calls `setPushToken` once per session — verify it works on a real device.
6. **Browse rebuild** — proper §10.2 layout: role-aware feed (`kind = isCreator ? 'gig' : 'service'`), category chips (7), sort dropdown (4 modes), client-side substring search. Existing browse compiles but uses legacy filter UI; replace with the design-doc treatment.
7. **service/[id] + gig/[id] rebuild** — proper detail screens per §10.3: KPI top-left (price/budget), status pills top-right, F-pattern hierarchy, owner card with profile link. Buy/Apply CTAs stubbed disabled with "Coming soon" subcopy.
8. **profile/[id] (public)** — handle resolution via `directoryService.getProfileByHandle` (already implemented in step 1). Render both sides (creator + brand) when present. Reputation block stubbed for step 4.
9. **Settings → Profile** — three-section form per §13.1:
   - **Basics**: display name, bio (multi-line), country (ISO-3166-1 alpha-2 combobox), avatar (1:1 crop, JPEG, ≤ 2 MB) via [pickImage](lib/services/imageUploadService.ts) + `uploadProfilePicture`.
   - **Creator section**: niches (1–6, lowercased, suggested chips), portfolioUrl, socialLinks list (paste URL or handle, validate via [socialLinks.ts](lib/utils/socialLinks.ts)), dmContact (email/telegram/phone, each independently nullable).
   - **Brand section**: companyName (required, 1–60), industry (combobox over INDUSTRY_GROUPS — needs a [industries.ts](lib/utils/) port from web), websiteUrl, dmContact.
   Sticky save bar; per-side "Clear" button calls `updateCreatorProfile(null)` / `updateBrandProfile(null)`.

**Acceptance signals:**
- Push token visible in `profiles/{uid}.pushToken` for a fresh device; firing a test notification via the Cloud Function reaches the device.
- Browse paginates against real `services/` + `gigs/` data, with category + sort + search working.
- Round-trip both creator + brand on the same uid; `isCreator`/`isBrand` flip in lockstep with no rule rejections.
- ProfileGate blocks `(tabs)` until at least one side is set up; clearing both sides re-engages the gate.
- Service / gig detail screens render the v1 shapes correctly; public profile resolves by handle.

---

## Step 3 — Authoring + applications + threads *(pending)*

Goal: creators list services and apply to gigs; brands post gigs and triage applicants; both sides chat in inbox threads end-to-end. Settlement still stubbed.

**Build order:**
- **Listings authoring**: `app/(home)/services/{index,new,[id]/edit}.tsx` (creator-only, `<ProfileGate require="creator">`); `app/(home)/gigs/{index,new,[id]/edit}.tsx` (brand-only). Listing media upload via [listingMediaUploadService](lib/services/listingMediaUploadService.ts) (≤ 5, 50 MB, image+video). Archive = status flip.
- **Applications**: Apply CTA on `gig/[id]` → modal with message + ≤ 4 sample URLs. Two writes: deterministic-id `createApplication` + best-effort `createApplicationThread`. `app/(home)/applications.tsx` (creator) with status-tab filter; `app/(home)/applicants.tsx` (brand) with shortlist / award / reject.
- **Threads & messaging**: implement [threadsService.ts](lib/services/threadsService.ts) per §7.5 (deterministic `${kind}_${parentId}` id; self-zero unread on `markThreadRead`). Rebuild [(tabs)/inbox.tsx](app/(home)/(tabs)/inbox.tsx) as participants list ordered by `lastMessageAt`. New `app/(home)/inbox/[threadId].tsx` — the §12 state machine (header status pills, message log of 5 kinds, conditional CTAs by role+status+dispute, banners, self-zero on mount). Composer: text + ≤ 5 attachments via [messageMediaUploadService](lib/services/messageMediaUploadService.ts).
- `submitDeliverable` and `approveDeliverable` writers stubbed disabled with "Pending escrow" subcopy until step 4.

**Acceptance signals:**
- Creator → apply → brand sees applicant in `/applicants` → award flips application + gig status; siblings auto-rejected by `cascadeApplicationsOnGigClose`.
- Two test accounts round-trip a thread; counterparty unread bumps land via `onMessageCreate`; self-zero on open works.
- Listing CRUD; storage uploads succeed under the 50 MB cap.

---

## Step 4 — Money: wallet + escrow + deliveries + reviews/disputes/notifications + settings *(pending)*

Goal: a brand buys a service end-to-end on devnet; creator submits; brand approves; reviews and disputes work; notifications feed and settings are complete. Removes legacy direct-transfer payment path.

**Decisions taken:**
- ✅ **Skip arbiter dispute UI on mobile.** Arbiters use web. Re-evaluate post-launch.

**Build order:**
- **Dependencies**: add `@coral-xyz/anchor`, `bs58`. Existing polyfills in [index.js](index.js) cover Anchor's needs.
- **Wallet**: rebuild `app/(home)/wallet.tsx` (or move from settings) — balance, send (existing [transferSol](lib/solana/transferSol.ts) keeps powering Send), receive (QR via `react-native-qrcode-svg`), recent activity, devnet airdrop gated on `IS_DEVNET_LIKE`. New `app/(home)/wallet/sales.tsx` (`listOrdersAsSeller`) and `app/(home)/wallet/purchases.tsx` (`listOrdersAsBuyer`).
- **Anchor + escrow**: `lib/anchor/{idl,program,pda}.ts` (PDA derivation must pass the SHA-256 fixture in `pda.test.ts`). `lib/escrow/{_send,fundService,submitDelivery,approveRelease}.ts` — wraps Privy embedded-wallet `signAndSendTransaction({ transaction, chain: SOLANA_CHAIN_ID })`.
- **BuyAction state machine**: `components/features/marketplace/BuyAction.tsx` — pre-flight balance → derive `contractId32` + `escrowPda` → `createOrder` → AsyncStorage breadcrumb → `fundService` → update breadcrumb with sig → best-effort `createOrderThread` → `markOrderPaid` (retry-with-backoff 3×500 ms) → clear breadcrumb → invalidate. Catch path: no sig → `markOrderFailed`; sig but no Firestore mark → leave breadcrumb.
- **RecoverPendingOrders boot job**: `components/features/marketplace/RecoverPendingOrders.tsx` mounted in [(home)/_layout.tsx](app/(home)/_layout.tsx). On cold start: read `adler.pendingOrders`, replay `markOrderPaid`, detect funded-but-unrecorded via `getAccountInfo(escrowPda)`.
- **Delete** [paymentService.ts](lib/services/paymentService.ts) + [useSolanaPayment.ts](hooks/useSolanaPayment.ts).
- **Submit + approve**: DeliverableDialog (seller, on `paid`) → `submitDelivery` → batched `submitDeliverable` (message + order paid → delivered atomically). ApproveDialog (buyer, on `delivered`) → `approveRelease` (idempotent: `null` sig if escrow already closed) → batched `approveDeliverable`. Auto-open RatingDialog on success.
- **Revisions**: cap = 2; third tap swaps CTA to "Open dispute". `escrowTxSignature` lives on the **message** doc, not the order doc.
- **Reviews**: 4-axis RatingDialog. Aggregate via `reviewsService.aggregate` on `profile/[id]`.
- **Disputes**: implement [disputesService.ts](lib/services/disputesService.ts). File CTA on threads in `paid` or `delivered` (and not `complete`). Banners: orange (open), lime (resolved). Show "Settlement pending the on-chain escrow program" via `PENDING_SETTLEMENT[outcome]`.
- **Notifications**: implement [notificationsService.ts](lib/services/notificationsService.ts). New `app/(home)/notifications.tsx` (long-form feed, mark-all-read). Bell badge for unread count. Deep-link mapping: register URL scheme in `app.config.ts`; route Cloud Function `href` paths to Expo Router. Tap-through via `Notifications.addNotificationResponseReceivedListener`.
- **Settings finishing**: `settings/notifications.tsx` (5 groups, dotted-path `setDoc` on `preferences/{uid}`); `settings/account.tsx` (identity readout, sign-out, danger-zone delete via `deleteUserAccount` + typed-`@username` confirm — App Store guideline 5.1.1(v)); `settings/billing.tsx` (`feeHistoryStats` over buyer + seller orders, last 20 settled).

**Optional follow-ups (tail commit):** spend dashboard (brand), my-applications counts, recently-active directory.

**Acceptance signals:**
- Real devnet `fund_service` ix lands; order flips `pending → paid`; killing the app mid-tx preserves the breadcrumb and recovers on next launch.
- Full state machine round-trips: `pending → paid → delivered → complete`. `txSignature` on the order is the fund_service sig; submit/approve sigs live on message docs.
- Push notifications received and tap-through deep-links to the right screen for each kind.
- Dispute filed on mobile surfaces on the web arbiter panel; resolved on web → mobile sees lime banner.
- Account deletion typed-confirm round-trips; Privy + Firebase users revoked; profile + slug deleted; orders/applications/reviews retained.

---

# Phase B — v1 closes *(post-parity, depends on Anchor program)*

After Step 4, mobile is feature-equivalent with web on the v1 path. The
on-chain program still has flows to ship — these land on web first
(`adler-program` repo + `adler-website` integration), then mobile
mirrors them. **Mobile's job in Phase B is to follow.** Don't lead.

Items tracked in [MOBILE_HANDOFF.md](MOBILE_HANDOFF.md) §8.11 ("What's NOT shipped on-chain yet"):

### Step 5 — Gig escrow

- On-chain `fund_gig` (fund-at-post): brand's budget locked at gig creation, not at award time. Replaces the current "transfer at award" pattern.
- On-chain `bind_creator` (bind-on-award): when the brand awards an applicant, the locked budget binds to that creator's contract.
- Mobile work: extend [lib/escrow/](lib/escrow/) with `fundGig` + `bindCreator` wrappers; rewire [gig/[id].tsx](app/(home)/gig/[id].tsx) award flow; update the `paid` order doc to know it came from a gig path.

### Step 6 — Brand refunds + on-chain disputes + reputation

- On-chain `brand_refund` after the seller misses the delivery deadline.
- On-chain dispute filing + arbitration — `disputesService.fileDispute` and `resolveDispute` get on-chain counterparts. The "Settlement pending" badge in step 4 disappears for `refund_to_brand` and `split` outcomes.
- On-chain reputation cards (whitepaper §7) — review aggregates settle on-chain alongside the order.
- Mobile work: extend [lib/escrow/](lib/escrow/) wrappers; teach [disputesService.ts](lib/services/disputesService.ts) about the on-chain counterpart; render the on-chain rep card alongside the Firestore-aggregated stars on `profile/[id]`.

### Step 7 — Mobile push prefs

- v1 ships with mobile push fan-out **unconditional** ([functions/index.js](functions/index.js) — the comment notes this explicitly). In-app + email channels are gated on `preferences/{uid}.notifications[kind]`; push isn't.
- Add `pushNotifications` map to `preferences/{uid}` (or per-kind boolean alongside the existing in-app map). Cloud Function reads it before fanning out push.
- Mobile UI: extend [settings/notifications.tsx](app/(home)/settings/) (built in step 4) with a "Push" toggle column.

### Step 8 — Username editing *(maybe)*

- Currently read-only. Renaming requires a transactional `usernames/{slug}` migration: claim new slug + release old + update profile, all in one tx, with rollback on failure.
- Punted from v1 because the rule writers don't yet support multi-doc atomic updates that touch both reservation collection and profile.
- Skip if no user demand.

---

# Phase C — Production launch *(gated on Phase A acceptance + audit)*

### External escrow audit

The on-chain program needs a proper audit before mainnet. Without it, the V1_PROGRAM_ID stays pinned to devnet in [escrow.ts](lib/constants/escrow.ts). Audit is out of mobile scope — track via `adler-program` repo.

### Mainnet cutover

- Bump [escrow.ts](lib/constants/escrow.ts) `PROGRAM_IDS['mainnet-beta']` to the audited deploy.
- Ship a release note explaining the cutover.
- Squads multisig upgrade authority on mainnet (configured pre-deploy by program team).
- `EXPO_PUBLIC_FEE_TREASURY_ADDRESS` becomes mandatory in EAS production profile (already hard-fails in [featureGates.ts](lib/constants/featureGates.ts) when missing on mainnet).
- Switch `EXPO_PUBLIC_SOLANA_NETWORK=mainnet-beta` on the production EAS build profile.

### App Store submission

Required for App Store guideline compliance and TestFlight → production:

- **5.1.1(v) account deletion** — already covered: [settings/account.tsx](app/(home)/settings/) calls `deleteUserAccount` Cloud Function with typed-`@username` confirm. Built in step 4.
- **Privacy nutrition labels** — declare what's collected: Privy auth identifiers, Firebase auth, Solana wallet address, push token. **No analytics or third-party tracking** in v1 (mobile has no analytics SDK).
- **App Privacy + Terms URLs** — point at marketing site; verify both are reachable from `settings/account.tsx`.
- **Push notification entitlements** — APNs cert configured for production; Apple Push Notification key in EAS secrets. Test push delivery on a TestFlight build (not just dev client).
- **App Tracking Transparency (ATT)** — not needed unless a tracking SDK lands.
- **Demo account for review** — Apple reviewers need a working sign-in. Pre-provision a Privy demo user with both creator + brand sides, some test funds via devnet airdrop.
- **Screenshots + marketing copy** — generated separately; not engineering scope.
- Mobile work: prebuild + EAS submit pipeline configured; verify build runs cleanly on TestFlight before promoting.

### Crash reporting / observability

- Sentry already configured ([@sentry/react-native](package.json)). Verify production DSN + sourcemap upload in EAS post-publish hook.
- No backend analytics in v1 per the architecture rule (`No analytics/crash reporting on the client in v1`). Sentry is crash reporting only — keep it.

> **iOS-only.** Android is out of scope for the lifetime of this app, not just v1. The Android block in `app.json`, the `npm run android` script, the `Platform.OS === 'android'` branches, and the local `android/` prebuild folder were all stripped post-step-1. `app.json` declares `"platforms": ["ios", "web"]` and `prebuild` runs `--platform ios`. Don't reintroduce Android-specific code, deps, or copy.

---

# Phase D — Post-launch iteration *(driven by usage data)*

These are not pre-launch blockers; they're directions to consider after v1 ships.

### Performance + startup

- Bundle size budget. Cold-start time measurement (Sentry traces or a lightweight startup metric).
- Image lazy-loading + placeholder gradients (already partially done in [ListingCard](components/ui/ListingCard.tsx)).
- React Query staleTime tuning per surface (currently a uniform 5 min; wallet is tighter at 15 s).

### Accessibility audit

- VoiceOver pass on every screen — the design rules ([ux-principles.md](.claude/rules/ux-principles.md) §12) call for legend-before-data on charts, narrative summaries on aggregates, focusable data points. None of the chart code is wired up in v1; audit when [components/ui/charts/](components/ui/) gets used.
- Touch target sizes — all ≥ 44pt, verify on the smallest supported iPhone.
- Contrast ratios — verify both light and dark themes pass WCAG AA.

### Localization

- Currently English-only. Centralized copy is in [lib/utils/copy.ts](lib/utils/copy.ts) (empty states) but most strings are inline. Add an i18n layer (`expo-localization` + `i18n-js`) when launching outside English-speaking markets.

### v2 considerations *(from MOBILE_HANDOFF.md §0/§4)*

- **Guest browse**: currently sign-in is mandatory before any marketplace interaction (wallet requirement). Could open `/browse` to unauthenticated users for discovery, push sign-in only at apply/buy. Needs Privy session deferral.
- **In-app messaging beyond threads**: e.g. a creator-to-brand cold DM that doesn't require a gig/order. The `dmContact` opt-in fields are already on profiles; the UX would route to external (email/telegram/phone) for v1, but native could route to a new lightweight thread kind.
- **Saved listings → recommendations**: leverage `saves/` to seed a "you might like" feed.
- **Earnings analytics**: charts are reserved in [components/ui/charts/](components/ui/charts/) but not used. Sales-over-time, fee-per-deal, response-rate dashboards would land here.

---

## Verification — every step

After each step:
1. `npm run typecheck` and `npm run lint` — both clean.
2. Smoke-test the touched flow on a real device (`npm run ios -- --device` or TestFlight) against `emptea-adler`. Per [MOBILE_HANDOFF.md](MOBILE_HANDOFF.md) §18, the emulator is for rule lints only — trust the live project.
3. Watch the Firestore console + Cloud Function logs for unexpected rule rejections or errors.

**Do not move to the next step until all acceptance signals pass.**

---

## Decisions log

| # | Step | Decision | Rationale |
|---|---|---|---|
| 1 | 2 | Delete `role-select.tsx`; rely on `<ProfileGate>` | Web does the same; gate covers all subsequent enforcement |
| 2 | 4 | Skip arbiter dispute UI on mobile | Arbiters use web; reduces scope |

**Open decisions:**

| # | Step | Decision | Notes |
|---|---|---|---|
| A | 4 | Universal links + URL scheme registration scope | Need at least the `app.config.ts` URL scheme for push deep-links. Marketing-style universal links are nice-to-have. |
| B | 2/3 | Profile-settings depth this step | Plan has full three-section form in step 2. Alternative: basics-only in step 2, defer creator/brand sections to a small step 2.5. Confirm before starting. |

---

## Where to look

- Spec (web team's handoff): [MOBILE_HANDOFF.md](MOBILE_HANDOFF.md) — esp. §8.11 (what's not shipped on-chain), §13 (settings spec), §17 (mobile-specific recommendations), §18 (the 15-step build order this doc compresses into 4 phases)
- Backend rules (the contract): [firestore.rules](firestore.rules)
- Cloud Functions: [functions/index.js](functions/index.js)
- Step-1 baseline commit: `c504b6a`
- Web reference client: `/Users/maruthan/Documents/GitHub/adler-website/`
- On-chain program: `/Users/maruthan/Documents/GitHub/adler-program/` *(separate audit + deploy pipeline; mobile doesn't ship here)*

---

## Phase boundaries — when to move

| | Trigger to start | Output |
|---|---|---|
| **A → B** | Phase A acceptance signals all pass on emptea-adler | Mobile is feature-equivalent with web on v1 |
| **B → C** | Phase B flows shipped on web first, mobile mirrors | Both clients aligned on full v1 spec |
| **C → launch** | External audit passes; mainnet program deployed | App in TestFlight ready to promote |
| **D → ongoing** | Post-launch usage data is in | Iteration backlog driven by actual user behavior |

Holding to this discipline matters most at A → B: it's tempting to start the on-chain catchup on mobile in parallel with the web team, but they own the IDL and the program semantics. Mobile mirrors what's already merged.

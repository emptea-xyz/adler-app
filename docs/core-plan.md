# Adler Mobile — Core Plan

> Polished, locked execution plan for the iOS app. Companion to
> [PORT_PLAN.md](PORT_PLAN.md) (long form) and
> [MOBILE_HANDOFF.md](MOBILE_HANDOFF.md) (web team's spec). This file is
> the source of truth for **what we're building, in what order, with
> which decisions locked**. PORT_PLAN stays as the long reference;
> divergences from it are noted inline.

---

## Vision

A mobile-first marketplace for creators and brands.

- **Creators** record + publish short videos directly in the app, list services, apply to gigs, get paid in SOL.
- **Brands** post text-only gigs, review applicants, buy services off the shelf, spend in SOL.
- **One account holds both sides.** Mobile requires both profiles to be set up at onboarding (web allows one-sided users; mobile does not).
- **View-mode toggle** switches between creator-optimized and brand-optimized surfaces. Tab bar shape changes per role.

---

## Mobile-only divergences from web

These are deliberate departures from `MOBILE_HANDOFF.md` parity:

1. **Both profiles mandatory at onboarding.** Web lets users set up one side and add the other later. Mobile asks for both up-front.
2. **In-app video studio.** Web takes pre-recorded files via picker only. Mobile records + edits inside the app (Stories-style flow).
3. **Tab bar adapts to view mode.** Creator view = 4 tabs. Brand view = 3 tabs (no Create button). The center upload-arrow button only renders for creators.
4. **No "Clear" button on profile sections.** Web allows users to drop a side; mobile doesn't (would re-engage the gate). Removed entirely.
5. **No arbiter dispute UI.** Arbiters use web. Confirmed earlier in PORT_PLAN.

---

## Phase A — v1 parity

### Step 1 — Schema migration ✅ done

Commit `c504b6a`. v1 Firestore shape, services collection, deterministic ids, denorm flags. See PORT_PLAN §Step 1 for the full delta.

---

### Step 2 — Onboarding + dual-profile + browse + push

Goal: a fresh user signs in → onboarding (mandatory both sides) → lands in browse → device receives push.

#### Onboarding shape (locked: linear)

```
Intro slides (3) → Basics → Creator → Brand → Browse
```

- Progress dots at top of screens 4–6 (3 dots, filled left-to-right)
- Sticky "Next" / "Finish" at bottom thumb zone
- Back arrow top-left on screens 5–6
- Each group is one screen, validated on submit

**Screen-by-screen field list:**

| Screen | Fields |
|---|---|
| Basics | display name (1–50), bio (≤ 280), country (combobox), `@handle` chip read-only with "rename later" caveat |
| Creator | niches (1–6 chips), portfolio URL, social links list (URL/handle, dedupe by platform+handle) |
| Brand | company name (1–60, required), industry (bottom-sheet picker), website URL |

**Deferred from onboarding** (unblocked, prompted later):
- Avatar — first profile-view CTA
- DM contact (creator + brand) — settings-only

#### Build sub-order

**2.0 — Foundations**
- `<ProfileGate require="both">` at `components/base/ProfileGate.tsx`
- `ViewModeContext` at `contexts/ViewModeContext.tsx` — `availableModes` always `['creator', 'brand']` post-onboarding; persists preference via AsyncStorage `VIEW_MODE`
- Delete `app/(auth)/role-select.tsx`; update `(auth)/_layout.tsx` + `app/index.tsx` routing
- `<SearchableSheet>` primitive (industry + niches both consume it)
- Port `lib/utils/industries.ts` from web (15 grouped `INDUSTRY_OPTIONS`)
- Port `lib/utils/socialLinks.ts` (URL/handle normalize + dedupe)

**2.1 — Onboarding flow** at `app/(auth)/onboarding/`
- `intro.tsx` — 3 slides (Welcome / Wallet / Devnet test SOL), persist `onboarding_seen`
- `basics.tsx` · `creator.tsx` · `brand.tsx`
- "Finish" → batched `updateCreatorProfile` + `updateBrandProfile` + flag flips → `/browse`

**2.2 — Push token registration**
- Extend `lib/services/pushService.ts` to write `profiles/{uid}.pushToken` on first auth boot
- `Notifications.addPushTokenListener` for rotation
- Pre-prompt screen before iOS permission dialog (see §Notifications, N3)

**2.3 — Browse v1 (role-aware)**
- Role-aware feed (`kind = viewMode === 'creator' ? 'gig' : 'service'`)
- Category chips (7 from `LISTING_CATEGORIES`)
- Sort dropdown (4 modes)
- Client-side substring search
- Empty states per role
- **Brand-only header chip:** `+ Post gig` pill at top-right

**2.4 — Detail screens**
- `service/[id].tsx` (rename from `package/[id]`) — KPI top-left, status pills top-right
- `gig/[id].tsx` — same pattern
- Buy/Apply CTAs disabled, "Coming soon"

**2.5 — Public profile**
- `profile/[id].tsx` — handle resolution via `directoryService.getProfileByHandle`, render both sections
- Reputation block stubbed
- Avatar prompt CTA fires here on own profile if `avatarUrl == null`

**2.6 — Settings → Profile**
- Three sections (basics + creator + brand), pre-filled from onboarding
- Avatar upload (the deferred field) via `pickImage` + `uploadProfilePicture`
- DM contact (deferred fields)
- Sticky save bar
- **No "Clear" button** (mobile divergence)

#### Acceptance signals

- Push token visible in `profiles/{uid}.pushToken` for fresh device; test push reaches device
- Browse paginates against real `services/` + `gigs/`; category + sort + search work
- Onboarding writes both `creatorProfile` + `brandProfile` in lockstep with `isCreator`/`isBrand`
- ProfileGate blocks `(tabs)` until both sides exist
- Service / gig detail screens render v1 shapes; public profile resolves by handle

---

### Step 3 — Studio + authoring + applications + threads

Goal: creators record + publish videos as services, apply to gigs; brands post gigs and triage applicants; both sides chat in inbox threads. Settlement still stubbed.

#### Tab bar shape (locked)

| View mode | Tabs |
|---|---|
| Creator | Browse · Inbox · **Create (oversized arrow)** · Profile |
| Brand | Browse · Inbox · Profile |

`AdlerTabBar` reads `viewMode` and renders accordingly. Routes stay registered for deep-link stability; only the visual button is conditional. Brand gig creation surfaces via:
1. Header chip on Browse: `+ Post gig`
2. FAB on Profile → My gigs

Both route to `app/(home)/gigs/new.tsx`.

#### Studio (locked)

Three full-screens, no bottom sheet (sheet is reserved for the gallery picker only).

| Screen | Tools |
|---|---|
| Camera | Hold-to-record (60s max), front/back, flash, gallery picker, close. `expo-camera`. |
| Edit | Full-screen preview · top-right tools: **Aa** (text overlay) and **Trim** |
| Form | Listing form: title, description, category, priceSol → Publish |

**Studio specs:**

| Decision | Locked |
|---|---|
| Entry point | Creator view → Camera direct (brand view: button hidden) |
| Aspect ratio | 9:16 only |
| Max length | 60s, min 1s |
| Multi-clip | Single clip only (carousel via 5 separate clips if user wants more) |
| Text overlay | One node · 6 colors (`Neutral.white`, `Neutral.black`, `Accent.pink`, `Accent.cyan`, `Accent.lime`, `Accent.orange`) · Geist SemiBold · drag + pinch (0.6×–2.0×) · no rotation |
| Cover frame | Auto at 0.5s into trimmed range |
| Text rendering | **Metadata, not burned.** Stored on service doc as `overlay: { text, x, y, scale, color } \| null`. Listing detail + feed cards render `<AbsoluteText>` over `<Video>` at playback. |
| Trim | Real (file shorter on export). `react-native-video-trim` (AVFoundation wrapper). |

**Tech:** `expo-camera` · `expo-video` · `expo-image-picker` (gallery) · `react-native-video-trim` · existing `listingMediaUploadService` (≤ 50 MB, mp4)

#### Service authoring

- After studio publishes → `app/(home)/services/new.tsx` (form)
- Form preserves video + overlay metadata via route params or AsyncStorage breadcrumb (app-background safety)
- On submit: `createService({ ..., mediaUrls: [uploadedUrl], overlay })`
- `services/index.tsx` — own services, status filter, archive (status flip)
- `services/[id]/edit.tsx` — edit text only; replacing video re-runs studio
- `<ProfileGate require="creator">` on these routes

#### Gig authoring

- `gigs/new.tsx` — title, description, category, budgetSol, requirements, optional reference media (≤ 5 via gallery picker, no studio)
- `gigs/index.tsx` + `gigs/[id]/edit.tsx`
- `<ProfileGate require="brand">`

#### Applications

- Apply CTA on `gig/[id]` (creator view) → modal with message + ≤ 4 sample URLs
- Two writes: deterministic `createApplication` + best-effort `createApplicationThread`
- Surfacing: **Profile tab sub-section + Inbox** (no new tabs)
  - `applications.tsx` (creator) — status-tab filter
  - `applicants.tsx` (brand) — per-gig list with shortlist / award / reject

#### Threads & messaging

- `threadsService.ts` per `MOBILE_HANDOFF.md` §7.5 — deterministic ids, self-zero unread
- `(tabs)/inbox.tsx` rebuild — participants list ordered by `lastMessageAt`
- `inbox/[threadId].tsx` — full state machine (header pills, 5 message kinds, conditional CTAs by role+status+dispute, banners, self-zero on mount)
- **Composer:** Send button · Return = newline · `+` icon → action sheet (Camera / Gallery / Files)
- Submit/approve writers stubbed disabled with "Pending escrow" subcopy until Step 4

#### Acceptance signals

- Creator records → trims → adds text → publishes service → appears in brand-view browse with overlay
- Apply round-trip: creator → brand sees in `/applicants` → award flips application + gig status; siblings auto-rejected
- Two test accounts round-trip a thread; counterparty unread bumps via `onMessageCreate`; self-zero on open
- Listing CRUD; storage uploads under cap

---

### Step 4 — Money: wallet + escrow + reviews + disputes + notifications + settings

Goal: brand buys service end-to-end on devnet; creator submits; brand approves; reviews + disputes work; notifications feed and settings complete. Removes legacy `paymentService`.

#### Dependencies

- Add `@coral-xyz/anchor`, `bs58`. Existing polyfills in `index.js` cover Anchor.

#### Wallet (locked)

| Decision | Locked |
|---|---|
| Entry points | Dedicated `(home)/wallet.tsx` route · Profile section link · Browse balance pill (already exists). Settings/wallet redirects or deletes. |
| Send UX | Modal screen (mirrors `checkout.tsx` shape) |
| Receive UX | Bottom sheet (QR + address copy) |
| Devnet airdrop | Button on wallet, gated by `IS_DEVNET_LIKE`, "Get test SOL" label, toast w/ explorer link |
| Sales/Purchases | One route, segmented toggle (`<SegmentedToggle>` already exists) |

#### Buy flow (locked)

| Decision | Locked |
|---|---|
| Confirmation | Full-screen route (existing `checkout.tsx`) — single Pay CTA, thumb-zone |
| Pending recovery | Silent on success, toast only on failure |
| Mid-tx app-kill resume | Boot job + toast (no persistent banner) |

**State machine** (`components/features/marketplace/BuyAction.tsx`):

```
1. Pre-flight balance check
2. orderId = uuid → derive contractId32 + escrowPda
3. createOrder → Firestore pending
4. setPendingOrder breadcrumb (AsyncStorage)
5. fundService → on-chain
6. update breadcrumb with sig
7. createOrderThread (best-effort)
8. retryWithBackoff(markOrderPaid, 3 × 500ms)
9. clearPendingOrder
10. invalidate balance / activity / orders.byBuyer / threads
```

`RecoverPendingOrders` mounted in `(home)/_layout.tsx`. Cold-start: read breadcrumb, replay `markOrderPaid`, detect funded-but-unrecorded via `getAccountInfo(escrowPda)`.

**Delete:** `paymentService.ts` + `useSolanaPayment.ts`.

#### Submit / approve (locked)

| Decision | Locked |
|---|---|
| Deliverable submission | Full-screen `DeliverableDialog` (text + ≤ 5 attachments via `messageMediaUploadService`) |
| Approve action | `ConfirmDialog`, auto-open `RatingDialog` on success |
| Revision counter | Visible: "Request revision (1 of 2)". 3rd tap → CTA flips to "Open dispute". |
| Rating dialog | Skippable; persistent "Rate buyer/seller" CTA on thread until completed |

`escrowTxSignature` lives on the **message** doc, not the order doc.

#### Reviews (locked)

- 4-axis `RatingDialog` (scope, communication, timeliness, quality), 1–5 each, optional comment ≤ 500
- Single screen, 4 star rows + comment field
- Aggregate via `reviewsService.aggregate` on `profile/[id]`

#### Disputes (locked)

| Decision | Locked |
|---|---|
| File flow | Full-screen modal (consequential), `ConfirmDialog` on submit |
| Trigger | CTA on threads in `paid` or `delivered` (not `complete`); auto-flip from revisions on 3rd tap |
| Banners | Open: orange · Resolved: lime + outcome note · Append "Settlement pending the on-chain escrow program" via `PENDING_SETTLEMENT[outcome]` |
| Arbiter UI | **Skipped on mobile** (web only) |

#### Notifications (locked)

| Decision | Locked |
|---|---|
| Bell entry point | Header icon on Browse, badge for unread count |
| Feed UX | `notifications.tsx` — long-form, mark-all-read top-right, tap-to-deeplink, pull-to-refresh |
| Push permission timing | Pre-prompt screen at first auth boot ("Get notified when buyers reach out") → tap triggers iOS dialog |
| Deep links | URL-scheme only for v1; universal links deferred |

Cloud Function deep-link routes: `/inbox/order_xyz`, `/applicants`, etc. Map via `Notifications.addNotificationResponseReceivedListener`. Register URL scheme in `app.config.ts`.

#### Settings finishing (locked)

| Screen | Spec |
|---|---|
| `settings/notifications.tsx` | 5 groups (Orders / Messages / Applications / Disputes / System), in-app + email toggles only. **No push column** until Phase B step 7. |
| `settings/account.tsx` | Identity readout (handle, email, wallet) · Sign-out (`#DC143C`) · Delete account (typed `@username` confirm → `deleteUserAccount` Cloud Function → sign out → `/sign-in`) |
| `settings/billing.tsx` | `feeHistoryStats` over buyer + seller orders. KPIs at top + last 20 settled as a list (role chip, fee in SOL, link to order thread). **No chart.** |

#### Acceptance signals

- Real devnet `fund_service` ix lands; order flips `pending → paid`; killing the app mid-tx preserves breadcrumb and recovers on next launch
- Full state machine round-trips: `pending → paid → delivered → complete`
- Push notifications received and tap-through deep-links to right screen per kind
- Dispute filed on mobile surfaces on web arbiter panel; resolved on web → mobile sees lime banner
- Account deletion typed-confirm round-trips; Privy + Firebase users revoked; profile + slug deleted; orders/applications/reviews retained

---

## Phase B — On-chain catchup *(post-parity, depends on Anchor program)*

Mobile mirrors web. Web ships first, mobile follows.

| Step | Scope |
|---|---|
| 5 | Gig escrow: `fund_gig` (fund-at-post) + `bind_creator` (bind-on-award) |
| 6 | Brand refunds + on-chain disputes + on-chain reputation cards |
| 7 | Mobile push prefs (add `pushNotifications` map to `preferences/{uid}`; settings/notifications gains a push column) |

Username editing (Phase B step 8 in PORT_PLAN) skipped — re-evaluate post-launch.

---

## Phase C — Production launch

| Block | Scope |
|---|---|
| External escrow audit | Out of mobile scope. Tracked via `adler-program` repo. |
| Mainnet cutover | Bump `V1_PROGRAM_ID` in `escrow.ts` · `EXPO_PUBLIC_FEE_TREASURY_ADDRESS` mandatory · `EXPO_PUBLIC_SOLANA_NETWORK=mainnet-beta` on production EAS profile |
| App Store submission | 5.1.1(v) account deletion ✅ (Step 4) · Privacy nutrition labels (Privy auth, Firebase auth, wallet address, push token; **no analytics**) · Privacy + Terms URLs · APNs prod cert · Demo account · Screenshots + marketing copy (separate scope) |
| Crash reporting | Sentry already configured. Verify production DSN + sourcemap upload. **No backend analytics** per architecture rule. |

**iOS-only.** Android stripped post-Step-1. Don't reintroduce.

---

## Phase D — Post-launch iteration

Driven by usage data. Not pre-launch blockers.

- **Performance:** bundle size budget · cold-start metric · image lazy-loading · React Query staleTime tuning
- **Accessibility:** VoiceOver pass · touch targets ≥ 44pt · contrast ratios (WCAG AA) for both themes
- **Localization:** English only at v1. Add `expo-localization` + `i18n-js` when launching outside English-speaking markets.
- **v2 considerations:** guest browse · cold DM (creator → brand) · saved listings → recommendations · earnings analytics (Skia chart infra ready)

---

## Verification — every step

1. `npm run typecheck` and `npm run lint` clean
2. Real-device smoke against `emptea-adler` (`npm run ios -- --device` or TestFlight). Emulator is for rule lints only.
3. Watch Firestore console + Cloud Function logs for unexpected rule rejections

**Don't move to next step until all acceptance signals pass.**

---

## Decisions log

### Locked (this round)

| # | Step | Decision |
|---|---|---|
| 1 | 2 | Onboarding shape: linear (Intro → Basics → Creator → Brand → Browse) |
| 2 | 2 | Avatar deferred to first profile view |
| 3 | 2 | DM contact deferred to settings |
| 4 | 2 | Username surfaced read-only on Basics with "rename later" caveat |
| 5 | 2 | Industry picker: bottom sheet with search |
| 6 | 2 | No "Clear" button on settings (mobile mandates both sides) |
| 7 | 3 | Tab bar adapts to view mode: creator 4 tabs, brand 3 tabs |
| 8 | 3 | Brand gig creation: Browse header chip + Profile FAB |
| 9 | 3 | Studio: 3 full screens (Camera / Edit / Form), no bottom sheet |
| 10 | 3 | Studio: 9:16, 60s max, single clip |
| 11 | 3 | Text overlay: one node, 6 colors, Geist SemiBold, drag + pinch, no rotation |
| 12 | 3 | Cover frame: auto at 0.5s |
| 13 | 3 | Text overlay rendered as metadata, not burned in |
| 14 | 3 | Applications/applicants surface in Profile sub-section + Inbox |
| 15 | 3 | Composer: send button, Return = newline, `+` icon → action sheet |
| 16 | 4 | Wallet: dedicated route + Profile link + Browse pill |
| 17 | 4 | Send: modal screen · Receive: bottom sheet |
| 18 | 4 | Devnet airdrop button gated by `IS_DEVNET_LIKE` |
| 19 | 4 | Sales/Purchases: one route, segmented toggle |
| 20 | 4 | Buy flow: full-screen checkout |
| 21 | 4 | Pending recovery: silent on success, toast on failure only |
| 22 | 4 | Deliverable submission: full-screen dialog |
| 23 | 4 | Approve: ConfirmDialog, auto-open RatingDialog |
| 24 | 4 | Revision counter visible: "(1 of 2)" |
| 25 | 4 | Rating dialog skippable, persistent CTA fallback |
| 26 | 4 | Rating dialog: single screen, 4 star rows + comment |
| 27 | 4 | Dispute file: full-screen modal + ConfirmDialog submit |
| 28 | 4 | Skip arbiter UI on mobile |
| 29 | 4 | Bell on Browse header with badge |
| 30 | 4 | Push permission: pre-prompt at first auth boot |
| 31 | 4 | Deep links: URL-scheme only for v1 |
| 32 | 4 | Settings/notifications: in-app + email only, no push column until Phase B |
| 33 | 4 | Settings/billing: KPIs + 20-row list, no chart |

### Open

None at this writing. Re-open if implementation surfaces new questions.

---

## Where to look

- Long-form plan: [PORT_PLAN.md](PORT_PLAN.md)
- Web team's spec: [MOBILE_HANDOFF.md](MOBILE_HANDOFF.md) (esp. §7 service layer, §8 escrow, §12 thread state machine, §13 settings)
- Backend rules (the contract): [firestore.rules](firestore.rules)
- Cloud Functions: [functions/index.js](functions/index.js)
- Sprint rules: [.claude/rules/hackathon.md](.claude/rules/hackathon.md)
- Web reference: `/Users/maruthan/Documents/GitHub/adler-website/`
- On-chain program: `/Users/maruthan/Documents/GitHub/adler-program/`

# Adler Mobile — Core plan checklist

Companion to [core-plan.md](./core-plan.md). Checkboxes reflect **confirmed implementation in this repo** as of last audit pass **2026-05-09** (see **Verification** + **Audit worksheet** below); `[ ]` means not done or not matching spec verbatim. *[Partial]* briefly explains gaps.

Legend: **`[x]`** = verified in codebase (this pass cites files where helpful) · **`[ ]`** = open, not matching spec, device QA pending, or only *partial* (see italic note on the line).

---

## Vision

- [ ] Creators record + publish short videos in app, list services, apply to gigs, get paid in SOL — *studio pipeline works; full locked studio spec incomplete (camera/trim/etc.)*
- [x] Brands post gigs, review applicants, buy services, spend SOL
- [x] One account holds both sides; mobile onboarding requires both profiles
- [x] View-mode toggle; tab shape changes per role

---

## Mobile-only divergences

- [x] **1.** Both profiles mandatory at onboarding
- [ ] **2.** In-app video studio (Stories-style) — *recording uses image-picker flow; not `expo-camera` hold-to-record per plan table*
- [x] **3.** Tab bar: creator 4 tabs / brand 3 tabs; create only creators
- [x] **4.** No "Clear" button on profile sections (settings profile)
- [x] **5.** No arbiter dispute UI on mobile

---

## Phase A — v1 parity

### Step 1 — Schema migration

- [x] Historical commit note `c504b6a` / v1 schema (treated as ✅ in plan — not re-audited here)

---

### Step 2 — Onboarding + dual-profile + browse + push

#### Onboarding shape (linear)

- [ ] Intro → Basics → Creator → Brand → Browse; progress dots screens 4–6 *filled left-to-right* — *three dots exist per screen (`basics.tsx` fills first only · `creator.tsx` fills first two · `brand.tsx` fills all three) — not a single advancing L→R pattern across steps*
- [x] Sticky Next / Finish in thumb zone
- [x] Back arrow creator + brand steps
- [x] One screen per step, validated on submit

#### Screen fields (Basics / Creator / Brand)

- [x] Basics: display name 1–50, bio ≤280, country combobox, read-only `@handle` + rename caveat
- [x] Creator: niches 1–6, portfolio URL, social links + dedupe
- [x] Brand: company 1–60, industry searchable sheet, website URL

#### Deferred onboarding

- [x] Avatar → first profile / settings
- [x] DM contact → settings only

#### 2.0 Foundations

- [x] `<ProfileGate require="both">` — `components/base/ProfileGate.tsx`
- [x] `ViewModeContext` + AsyncStorage `VIEW_MODE`
- [x] `role-select.tsx` removed; `(auth)/_layout` + `app/index` routing updated
- [x] `SearchableSheet` for industry/niches
- [x] `lib/utils/industries.ts`
- [x] `lib/utils/socialLinks.ts`

#### 2.1 Onboarding flow

- [x] `intro.tsx` — 3 slides, `ONBOARDING_SEEN`
- [x] `basics` · `creator` · `brand`
- [x] Finish → dual profile writes → `/browse`

#### 2.2 Push token

- [x] Persist `profiles/{uid}.pushToken` — **`setPushToken`** merge on `profiles` collection ([`profileService.ts`](lib/services/profileService.ts)); callers in [`UserContext.tsx`](contexts/UserContext.tsx) + token rotation path
- [x] Push token rotation listener
- [x] Pre-prompt (`PushPermissionPrompt`)

#### 2.3 Browse v1

- [x] Role-aware gig vs service feed
- [x] 7 categories from `LISTING_CATEGORIES`
- [x] Sort 4 modes
- [x] Client substring search
- [x] Empty states per role
- [x] Brand-only `+ Post gig` chip

#### 2.4 Detail screens

- [x] `service/[id].tsx` — KPI + status pills layout
- [x] `gig/[id].tsx` — same pattern
- [ ] ~~Buy disabled "Coming soon"~~ — *[Superseded] Step 4 enables Buy → checkout (plan line was Step 2 stub)*

#### 2.5 Public profile

- [x] `profile/[id].tsx`, handle resolution via directory / uid
- [x] Reputation — [`profile/[id].tsx`](app/(home)/profile/[id].tsx): `aggregate(...)` when `count > 0`; “Reputation pending” copy when empty
- [x] Avatar CTA when `avatarUrl == null` (own profile)

#### 2.6 Settings → Profile

- [x] Three sections basics + creator + brand
- [x] Avatar upload (`pickImage` + upload)
- [x] DM fields
- [x] Sticky save bar (`CtaFooter`)
- [x] No "Clear"

#### Step 2 acceptance signals

- [ ] Push token on profile + **successful test push** — *Firestore write ✅; end-to-end token registration + delivered notification not exercised in this pass*
- [x] Browse paginates services/gigs + category + sort + search
- [x] Onboarding writes both profiles + `isCreator` / `isBrand`
- [x] `ProfileGate` blocks `(tabs)` without both sides
- [x] Service/gig detail + profile by handle *(plus uid)*

---

### Step 3 — Studio + authoring + applications + threads

#### Tab bar (locked shape)

- [x] Creator: Browse · Inbox · Create arrow · Profile
- [x] Brand: Browse · Inbox · Profile (no middle create)
- [x] `+ Post gig` + Profile FAB → `gigs/new.tsx`

#### Studio (three screens — plan table)

**Screens**

- [ ] Camera: hold-to-record, front/back, flash, gallery, `expo-camera` — *current: **`ImagePicker.launchCameraAsync`** ([`studio/camera.tsx`](app/(home)/studio/camera.tsx)); front/back toggle only · no flash control · no `expo-camera`*
- [ ] Edit: full-screen preview; **Aa + Trim top-right** — *[ ] Trim via `react-native-video-trim`; edit uses text/color/scale in scroll*
- [x] Form: `services/new.tsx` title, description, category, priceSOL → Publish

**Studio specs**

- [x] Entry from creator tab — [`TabBar.tsx`](components/ui/TabBar.tsx) `router.push('/studio/camera')`; brand tab shape omits create slot
- [ ] Aspect ratio **9:16 only** — *not enforced; camera uses picker constraints only*
- [x] Max **60s** enforced — [`studio/camera.tsx`](app/(home)/studio/camera.tsx) `MAX_DURATION_SECONDS` + `videoMaxDuration`; **min 1s** not asserted
- [x] Intent: single clip (multi-carousel is separate listing concern)
- [ ] One text node, 6 colors, pinch scale ~0.6–2× — *colors + **±** scale buttons in [`studio/edit.tsx`](app/(home)/studio/edit.tsx); **no** drag (x/y) · overlay font not enforced as Geist SemiBold*
- [ ] Cover frame at **0.5s** into trimmed range
- [x] Overlay **metadata on service**, render over `<Video>`
- [ ] Trim: real file shortening via **react-native-video-trim**

**Tech stack line**

- [ ] Planned stack — *[partial: `expo-video`, image-picker present; expo-camera trim not integrated end-to-end]*

#### Service authoring

- [x] After studio → `services/new`
- [ ] Persist clip + overlay breadcrumb via **route params OR AsyncStorage** — *params only*
- [x] Submit `createService` + overlay + media upload
- [x] `services/index` + archive/filter patterns
- [x] `services/[id]/edit` text edit
- [x] `<ProfileGate require="creator">`

#### Gig authoring

- [x] `gigs/new` fields + references ≤5, no studio
- [x] `gigs/index` + `gigs/[id]/edit`
- [x] `<ProfileGate require="brand">`

#### Applications

- [x] Apply on gig (creator view) modal + samples
- [x] `createApplication` + `createApplicationThread`
- [x] `applications.tsx` + `applicants.tsx` + profile shortcuts

#### Threads & messaging

- [x] `threadsService` deterministic ids (`order_${id}`)
- [x] Inbox sorted by `lastMessageAt`
- [ ] `inbox/[threadId]` — *order lifecycle + dispute banners + actions in [`inbox/[threadId].tsx`](app/(home)/inbox/[threadId].tsx); no standalone `DeliverableDialog` / full-screen deliverable flow*
- [ ] Composer Send + newline + **`+`** Camera/Gallery/Files — *`+` toggles **inline** row of Camera / Gallery / Files buttons (not system `ActionSheet`-only); multiline `TextInput` + `Send` present*
- [ ] ~~Submit/approve stubbed “Pending escrow”~~ — *[Superseded] Step 4 enables actions*

#### Step 3 acceptance

- [ ] Record → **trim** → text → publish → brand browse overlay — *trim gap*
- [x] Applicants round-trip (apply → shortlist/reject/award)
- [ ] Two accounts thread unread + self-zero — *logic present; needs two-account device smoke test*
- [x] Listing CRUD + uploads under cap — *CRUD paths verified earlier; **50 MB** client guard + constant in [`listingMediaUploadService.ts`](lib/services/listingMediaUploadService.ts) (`LISTING_MEDIA_MAX_BYTES`); studio clip upload often omits `sizeBytes` (server rules still cap)*

---

### Step 4 — Money · wallet · escrow · reviews · disputes · notifications · settings

#### Dependencies

- [x] `@coral-xyz/anchor`, `bs58` listed in package.json *(Anchor program wiring for buy ix — see fund gap below)*

#### Wallet (locked)

- [x] Entry: `wallet.tsx`, settings row, browse header balance / wallet UX
- [x] Send modal (`SendSheet`) — mirrors checkout-ish full-screen modal pattern
- [x] Receive bottom sheet
- [x] Devnet "Get test SOL" gated `IS_DEVNET_LIKE`
- [x] Sales/Purchases segmented on wallet

#### Buy flow — structure

- [x] Full-screen `checkout.tsx` single Pay CTA
- [ ] Pending recovery UX — *[partial: success mostly silent; recovery/toast wording may not match “failure only” exactly]*
- [x] Mid-tx kill & resume — *breadcrumb replay + `RecoverPendingOrders`; `getAccountInfo(escrowPda)` reconcile not implemented*

#### Buy flow — state machine (`BuyAction.tsx`)

1. [x] Pre-flight balance check  
2. [x] UUID `orderId` → `contractId32` + `escrowPda`  
3. [x] `createOrder` pending  
4. [x] `setPendingOrder` breadcrumb  
5. [ ] `fundService` → on-chain — *current: SOL transfer to seller pubkey, not program **`fund_service`** ix*  
6. [x] Update breadcrumb with signature  
7. [x] `createOrderThread` best-effort  
8. [x] `retryWithBackoff(markOrderPaid, …)`  
9. [x] `clearPendingOrder`  
10. [x] Invalidate wallet / orders / threads  

Other

- [x] `RecoverPendingOrders` in `(home)/_layout.tsx`
- [ ] Cold-start replay + **funded-but-unrecorded via `getAccountInfo(escrowPda)`**
- [x] Delete legacy `paymentService.ts` + `useSolanaPayment.ts`

#### Submit / approve / revision / rating

- [ ] Deliverable submission as **standalone full-screen `DeliverableDialog`**
- [ ] Approve via **`ConfirmDialog`** + **auto-open `RatingDialog`** — *approval is inline composer + `approveDeliverable` from thread; rating via [`ReviewSheet`](components/features/reviews/ReviewSheet.tsx) on **[`order/[id].tsx`](app/(home)/order/[id].tsx)**, not auto-opened after approve*
- [x] Revision **“(N of 2)”** CTA + 3rd → dispute — *buyer button `Request revision (N of 2)`; exhausted → **`Open dispute`** ([`inbox/[threadId].tsx`](app/(home)/inbox/[threadId].tsx)); message bubble uses generic “revision request” label*
- [x] Skippable rating + thread entry to rate — *[`ReviewSheet`](components/features/reviews/ReviewSheet.tsx) dismissible/`onClose`; thread **`Rate counterparty`** → `/order/[id]` when `canRate`*
- [x] `escrowTxSignature` column on deliverable/**approval** writes — [`threadsService.ts`](lib/services/threadsService.ts) passes through optional `escrowTxSignature`
- [ ] Populate **`escrowTxSignature`** from on-chain txs in UI — *thread flows call `submitDeliverable` / `approveDeliverable` without `escrowTxSignature` → field persisted as **`null`**.*

#### Reviews

- [x] **4-axis** ratings + comment **≤500** + **aggregate** on profile — *[`ReviewSheet.tsx`](components/features/reviews/ReviewSheet.tsx) (`RATING_AXES`, `COMMENT_MAX`); not named `RatingDialog`*

#### Disputes

- [ ] File flow **full-screen modal + ConfirmDialog submit** as specified
- [ ] Triggers CTAs paid/delivered + revision exhaustion — *[partial threading]*
- [ ] Banners / `PENDING_SETTLEMENT` copy — *resolved dispute banner + `PENDING_SETTLEMENT` sentence in [`inbox/[threadId].tsx`](app/(home)/inbox/[threadId].tsx); exact orange/lime pill treatment vs plan table not matched line-for-line*

#### Notifications

- [x] Bell on browse/header path + unread badge (`AdlerHomeHeader`)
- [x] `notifications.tsx` list, mark-all, tap navigate, refresh
- [x] Pre-prompt first boot copy
- [x] URL / notification **deep-link scheme** — **`expo.scheme`** `"adler"` in [`app.json`](app.json) (no `app.config.ts` in repo); cold start + tap: [`readInitialNotificationHref` / `addNotificationResponseListener`](lib/services/pushService.ts) → [`app/_layout.tsx`](app/_layout.tsx) `router.push(href)`

#### Settings finishing

- [ ] **5 groups**, separate **in-app + email toggles** per row (no push column until Phase B) — *[`settings/notifications.tsx`](app/(home)/settings/notifications.tsx): **one `Switch` per `NotificationKind`** via [`NOTIFICATION_KIND_GROUPS`](lib/types/preferences.ts); no distinct email channel dimension in prefs model*
- [x] `settings/account.tsx` identity, destructive sign-out styling, typed delete calling `deleteUserAccount` CF
- [x] `settings/billing.tsx` KPIs + last ~20 settled, no chart

#### Step 4 acceptance signals

- [ ] Real devnet **`fund_service`** instruction + order **pending→paid**
- [ ] App-kill breadcrumb replay — *[signature replay ✅; escrow PDA reconciliation ❌]*
- [ ] Full **paid → delivered → complete** lifecycle — *[Firestore paths ✅ on-chain escrow settlement ❌ vs program]*
- [x] Push tap → **router navigation** (code) — *[`app/_layout.tsx`](app/_layout.tsx) + `pushService` listeners; **device** delivery + correct `href` payloads still require QA sign-off*
- [ ] Dispute surfaces web / resolved banner sync — *integration QA pending*
- [ ] Account deletion end-to-end (Privy + Firebase + slug) — *Cloud Function present; full revoke order QA pending*

---

## Phase B — On-chain catchup

*Verification pass: roadmap / not implemented in this app codebase (expected deferral).*

- [ ] Step 5: `fund_gig` + `bind_creator`
- [ ] Step 6: Refunds · on-chain disputes · reputation cards
- [ ] Step 7: `pushNotifications` prefs map + notifications settings push column
- [x] Username editing intentionally skipped (plan says re-evaluate)

---

## Phase C — Production launch

*Verification pass: launch checklist items not audited here unless shipping production.*

- [ ] Escrow audit (external repo) — *N/A mobile deliverable*
- [ ] Mainnet/env cutover — *gates in config; production profile not asserted here*
- [ ] App Store bundle: privacy nutrition, terms URLs, demo account, screenshots, etc.
- [ ] Crash reporting — *Sentry init present · prod DSN/sourcemaps verification open*

- [x] **iOS-only** / no Android in primary target — `app.json` lists `platforms`: `ios`, `web` (no Android)

---

## Phase D — Post-launch iteration

*(Backlog items — **[ ] not v1 checkpoints** unless you track backlog here)*

- [ ] Perf / a11y / i18n / v2 bullets as backlog

---

## Verification — every step

- [x] `npm run typecheck` + `npm run lint` clean — *2026-05-09 · both exit 0 in repo root*
- [ ] Real-device smoke `emptea-adler`
- [ ] Firestore rules + CF log spot-check during QA

### Audit worksheet (2026-05-09)

| Track | Result (code inspection) |
|--------|---------------------------|
| **Prep** | Typecheck + lint clean. |
| **A Studio** | `ImagePicker`-based capture ([`studio/camera.tsx`](app/(home)/studio/camera.tsx)); overlay edit ([`studio/edit.tsx`](app/(home)/studio/edit.tsx)); no **`react-native-video-trim`** / **`expo-camera`** hold-record. |
| **B Onboarding/push** | Push token merge on **`profiles`**; onboarding dot fill pattern differs per screen (see Step 2). |
| **C Threads** | Composer `+` = inline expandable attachment actions; unread zeroing via **`markThreadRead`**. Two-account QA not run. |
| **D Escrow** | **`fundService.ts`** → [`transferSol`](lib/solana/transferSol.ts) to seller; **`RecoverPendingOrders`** replays **`markOrderPaid(signature)` only** — no **`getAccountInfo(escrowPda)`**. |
| **E Step 4 UX** | Named `DeliverableDialog` / `ConfirmDialog` / `RatingDialog` absent; **`ReviewSheet`** covers multi-axis ratings; notification prefs single-channel. |

---

## Decisions log (locked)

| # | Done in codebase (strict) |
|---|---------------------------|
| 1–6 Step 2 | [x] |
| 7–8 Step 3 | [x] |
| 9 | [ ] *(studio: three-screen / no bottom sheet — see open items)* |
| 10–12 Step 3 | [ ] studio ratio / cover / overlay drag & type *(11 partial)* |
| 13 | [x] metadata overlay |
| 14–15 Step 3 | [ ] composer `+` = **inline row**, not ActionSheet-only (see Threads) |
| 16–20 Step 4 | [x] |
| 21 | [ ] *(pending recovery UX copy)* |
| 22–27 Step 4 | [ ] dialogs / confirmations as **`DeliverableDialog` / `RatingDialog`** etc. *(parity via `ReviewSheet` + inline thread actions)* |
| 28 | [x] no arbiter mobile |
| 29–31 Step 4 | [x] *deep link **`adler`** in [`app.json`](app.json) + `_layout` `router.push(href)`* |
| 32 | [ ] dual in-app/email columns |
| 33 Step 4 | [x] billing list |

*(If you want every row verbatim as `- [ ]` / `- [x]` instead of compressed table, say so—we can extend this file.)*

---

## Quick stats (optional)

Rough counts only: **`[x]` increased after 2026-05-09 pass** (~75+ discrete checks); remaining **`[ ]`** clusters: **studio fidelity** (`expo-camera`, trim file, 9:16 cover), **`fund_service` ix + escrow PDA reconcile**, **dual email/in-app prefs**, **plan-named dialogs**, **`escrowTxSignature` UI population**, Phase **B/C** roadmap, **device** QA rows.

---

*Upstream narrative + ordering remain in [core-plan.md](./core-plan.md).*

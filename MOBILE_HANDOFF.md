# Adler — Mobile Handoff Spec

> Source of truth for porting the **adler-website** MVP to the **adler-app**
> Expo client. Read this end-to-end before writing code. Every fact here is
> reverse-engineered from the deployed web client at `../adler-website` and
> the shared infra at `../adler-app` (rules, indexes, functions). When this
> doc and the code disagree, the **code** wins — but tell me, because one of
> them is stale.

The mobile app already has a working **tabbar shell** (`browse`, `inbox`,
`profile`, `saved`) and assorted UI primitives. What's missing is the
**backend wire-up** (Privy↔Firebase bridge, Firestore service layer, Solana
escrow integration) and most of the **domain-specific UI** (listings,
applications, threads, wallet, settings, reputation, disputes,
notifications). This document specifies all of that.

---

## 0. Critical migrations (do these first)

The mobile codebase predates the v1 schema. Before you do anything else:

1. **Rename `packages/` → `services/`.** The Firestore collection is now
   called `services` (rules: `match /services/{serviceId}`). Any mobile
   code still reading/writing `packages/*` is dead — the rules will reject
   the writes. This affects `lib/services/packageService.ts`, the
   `app/(home)/package/[id].tsx` route, every storage path
   (`packages/{uid}/…` → `services/{uid}/…`), and the `deleteUserAccount`
   Cloud Function (which still archives the legacy collection).
2. **Replace `paymentService.ts` with the escrow flow.** The legacy direct-
   transfer-with-fee path is being retired. v1 buys go through the on-chain
   Anchor escrow program (`fundService` → `submitDelivery` → `approveRelease`).
   See §8 for the exact flow.
3. **Profile schema is materially different.** The new shape has
   `creatorProfile` and `brandProfile` sub-objects, denormalized
   `isCreator` / `isBrand` flags, niches/industries pickers, and a
   `dmContact` opt-in object. See §5.1.
4. **The `role-select.tsx` first-run screen is gone** on web. Web does a
   three-slide intro and then inline `ProfileGate` overlays on
   role-locked routes. Mirror that pattern (or keep `role-select.tsx` if
   it pays off on mobile — but the gating logic still has to exist
   because a user can have *both* sides or *neither*).

---

## 1. What Adler is

Adler is a **Solana-native marketplace for user-generated content**.

- **Creators** sell short-form video services (TikTok hooks, testimonials,
  product b-roll, etc.) and apply to brand briefs ("gigs"). Get paid in
  SOL.
- **Brands** post gigs, review applicants, buy services off the shelf.
  Spend in SOL.
- **A single account can wear both hats** — `creatorProfile` and
  `brandProfile` are independent sub-objects on `profiles/{uid}`. The
  app exposes a Creator/Brand mode toggle.
- **Money settles on Solana** (devnet today, mainnet on escrow audit).
  An on-chain Anchor program (`../adler-program`) holds the brand's
  budget for the duration of the contract, releases on approval or
  auto-timeout.
- **Reputation is four-axis, weighted by deal size**: scope,
  communication, timeliness, quality.

The web client is desktop-only (gated below `lg` / 1024 px). Mobile is
the mobile-only complement — same Firebase project, same data, same
Privy app, different surface.

---

## 2. Tech stack & repo layout

### Shared backend (`../adler-app/`)
This sibling repo holds **all infra**: Firestore rules, indexes, Storage
rules, Cloud Functions, Firebase config. Both mobile and web are
clients. Do not duplicate rules in the mobile repo.

| File | Purpose |
|---|---|
| `firestore.rules` | Source of truth for every collection's auth + validation |
| `firestore.indexes.json` | Composite indexes the queries below depend on |
| `storage.rules` | Per-path size + content-type gates |
| `functions/index.js` | Cloud Functions (auth bridge, RPC proxy, fan-out, email) |

Deploy from `../adler-app/` with `firebase-cli` (already authenticated to
`emptea-adler`).

### Web client (`adler-website/`)
This is the canonical reference for what the mobile app should do.
Mirrors below describe the path conventions (read these before you guess):

```
contexts/             AuthContext, UserContext, ViewModeContext, DirtyFormsContext, QueryProvider
lib/firebase.ts       Single Firebase init (app, auth, db, storage, functions)
lib/types/*.ts        One file per Firestore collection — DOC SHAPES + ENUMS
lib/services/*.ts     One file per collection — ALL Firestore I/O
lib/constants/*.ts    queryKeys, storageKeys, featureGates, escrow
lib/solana/*.ts       Connection + read helpers + airdrop + (legacy) transferSolWithFee
lib/anchor/*.ts       IDL, typed Program, PDA derivation, account hooks
lib/escrow/*.ts       fundService / submitDelivery / approveRelease wrappers
lib/utils/*.ts        Pure helpers (firestoreTimestamp, formatSol, niches, industries, socialLinks, pendingOrders, retry)
```

### Mobile target (`../adler-app/`)
What's there and what to keep:

| Path | Status | Action |
|---|---|---|
| `app/(auth)/sign-in.tsx`, `intro.tsx`, `role-select.tsx` | ✅ Routes exist | Rewire sign-in to Privy + Firebase bridge; replace 3-slide intro with §6 copy; revisit role-select (see §6) |
| `app/(home)/(tabs)/browse,inbox,profile,saved` | ✅ Tabbar shell | Keep tabbar; rebuild each tab's content |
| `app/(home)/package/[id]` | ⚠️ Legacy name | Rename to `service/[id]`; rebuild detail screen |
| `app/(home)/gig/[id]`, `order/[id]`, `profile/[id]`, `checkout` | ✅ Routes exist | Rebuild |
| `app/(home)/settings/*` | ✅ Partial (about, appearance, wallet) | Add `profile`, `notifications`, `account`, `billing` per §13 |
| `lib/services/*Service.ts` | ⚠️ Mostly stale | Rebuild to mirror web (§7) |
| `lib/firebase/*` | ✅ Init exists | Keep init; replace SDK paths with web's pattern if helpful |
| `hooks/useSolanaPayment.ts` | ⚠️ Legacy | Replace with escrow wrappers (§8) |

Routes the mobile app does **not** have but **must add**:
- Application thread / order thread detail (deep-linked from `inbox`)
- Wallet → Sales / Purchases history
- Spend dashboard (brand-only)
- Applicants inbox (brand-only)
- My applications (creator-only)
- Notifications feed (long-form)
- Settings → notifications, account, billing
- (Maybe) Admin → disputes (arbiter-only) — skip if mobile arbiters don't ship

---

## 3. Environment variables

Mirror `.env.example` from `adler-website/`:

```sh
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=…
NEXT_PUBLIC_FIREBASE_PROJECT_ID=emptea-adler
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=…
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=…
NEXT_PUBLIC_FIREBASE_APP_ID=…
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=…

# Privy (web app id; native client id is for mobile)
NEXT_PUBLIC_PRIVY_APP_ID=…
NEXT_PUBLIC_PRIVY_CLIENT_ID=…   # mobile only — web ignores this

# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet           # devnet | mainnet-beta | testnet
NEXT_PUBLIC_SOLANA_RPC_PROXY_URL=…          # optional override
NEXT_PUBLIC_FEE_TREASURY_ADDRESS=…          # required in production (or hard-fail)
```

For Expo, drop the `NEXT_PUBLIC_` prefix and use `EXPO_PUBLIC_` instead, or
hoist into `app.config.ts`. Never commit `.env*` (existing rule).

The Solana RPC URL defaults to a Cloud Function proxy
(`solanaRpcProxyDevnet` / `solanaRpcProxyMainnet`) so the Helius API key
never ships in the client bundle — keep this on mobile too.

The Wallet Standard chain id is computed:
- `mainnet-beta` → `solana:mainnet`
- `testnet` → `solana:testnet`
- everything else → `solana:devnet`

---

## 4. Authentication flow

This is the **single most fragile piece** to port. Get this wrong and
nothing else works.

### 4.1 Mental model

```
[ Privy login ]                  [ Firebase Auth ]            [ Firestore ]
   Google OAuth                     custom token                  rules use
   embedded Solana wallet           uid == privyUserId            request.auth.uid
        │                                  ▲
        ▼                                  │
   getAccessToken() ─► mintFirebaseToken Cloud Function
                       (verifies Privy JWT, mints Firebase custom token)
```

Privy is the user-facing auth provider. Firebase Auth is a **derivative**
of Privy: every Privy session gets bridged to a Firebase custom token
whose `uid` equals the Privy user id. The Firestore rules pin
`request.auth.uid == userId`, so the same uid works for both.

### 4.2 Privy config (web; copy to mobile with `clientId` added)

```ts
<PrivyProvider
  appId={PRIVY_APP_ID}
  config={{
    embeddedWallets: {
      solana: { createOnLogin: "users-without-wallets" },
    },
    loginMethods: ["google"],
    appearance: {
      walletChainType: "solana-only",
    },
  }}
>
```

On native (`@privy-io/expo` or equivalent), pass `clientId` too — that's
the **native** Privy client id which web omits. On web, passing
`clientId` triggers a "nativeAppID" code path that breaks the OAuth
iframe.

### 4.3 Bridge code (verbatim contract — `lib/services/privyAuthService.ts`)

```ts
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken, signOut as fbSignOut } from "firebase/auth";
import { auth, functions } from "@/lib/firebase";

const mintFirebaseTokenFn = httpsCallable<
  { accessToken: string },
  { token: string; uid: string }
>(functions, "mintFirebaseToken");

const deleteUserAccountFn = httpsCallable<
  Record<string, never>, { ok: boolean }
>(functions, "deleteUserAccount");

export async function bridgeToFirebase(privyAccessToken: string) {
  const result = await mintFirebaseTokenFn({ accessToken: privyAccessToken });
  await signInWithCustomToken(auth, result.data.token);
  return result.data.uid;
}

export async function signOutOfFirebase() {
  if (auth.currentUser) await fbSignOut(auth);
}

export async function deleteAccount() {
  await deleteUserAccountFn({});
}
```

### 4.4 AuthContext lifecycle

The web `AuthContext` does this on every Privy state change:

1. `privy.ready === false` → wait.
2. `privy.user === null` → ensure Firebase is signed out, return.
3. `privy.user.id` differs from the last bridged id:
   1. `setIsBridging(true)`
   2. `getAccessToken()` from Privy
   3. `bridgeToFirebase(token)` — calls Cloud Function, signs in Firebase
   4. Cache the Privy id so re-renders don't re-bridge
   5. On error: toast, log out of Privy, sign out of Firebase
4. `privy.user.id` matches → no-op (token refreshes don't trigger re-bridge).

`signOut()` does **both** sides + `queryClient.clear()`.

### 4.5 Profile bootstrap (immediately after Firebase sign-in)

The first time a user lands authenticated, `UserProvider` runs
`ensureProfileExists(uid, walletAddress)` (see §7.1). This is a Firestore
transaction that:

- creates `profiles/{uid}` with a generated `username` slug (e.g.
  `lunaratelier3a4b`) + `displayName` (e.g. `Lunar Atelier`),
- reserves `usernames/{slug}` atomically pointing at the same uid,
- backfills `walletAddress` if Privy has provisioned an embedded
  wallet but the profile doc has none.

If a doc already exists, the same call refreshes `walletAddress` and
re-claims the slug if it was somehow cleared. **Idempotent.** Mobile
must run this same call.

### 4.6 Online/offline guard

`useAuth().runIfOnline(fn)` short-circuits writes when
`navigator.onLine` is false. On RN, swap for
`@react-native-community/netinfo` or equivalent.

### 4.7 App entry routing

The web `/app` page redirects:
- no Firebase user → `/sign-in`
- first-time (intro flag missing) → `/intro`
- returning → `/browse`

`onboarding_seen` flag is in localStorage; on mobile use `AsyncStorage`
or `expo-secure-store`.

### 4.8 Account deletion

`deleteUserAccount` Cloud Function:
1. Pauses all `services/*` owned by the caller
2. Closes all open `gigs/*` owned by the caller
3. Deletes `profiles/{uid}` and `usernames/{slug}`
4. Deletes the Privy user via admin API
5. Revokes the Firebase auth user

Orders, applications, reviews are **retained** for counterparty integrity.
The mobile UI for this lives at `/settings/account` and uses a
typed-name confirmation dialog ("type `@username` to confirm").

> **Heads up:** the current Cloud Function archives the legacy `packages`
> collection, not `services`. Will need a one-line bump after the schema
> migration; flag it but don't fix from mobile-side.

---

## 5. Firestore data model (the canonical schema)

Every collection mirrored below is defined in `../adler-app/firestore.rules`.
Every TypeScript type is in `lib/types/*.ts`. **Components never touch
Firestore directly** — go through `lib/services/*.ts`. Same convention
on mobile.

### 5.1 `profiles/{uid}`

```ts
interface Profile {
  id: string;
  username: string;          // ^[a-z0-9_]{3,20}$, slug-claimed in usernames/
  displayName: string;       // 1–50 chars
  bio: string;               // ≤ 280 chars
  avatarUrl: string | null;  // ≤ 2048 chars
  walletAddress: string | null;  // append-only once set
  pushToken: string | null;  // ≤ 256 chars; mobile writes Expo push token here
  country: string | null;    // ISO-3166-1 alpha-2 uppercase, or null = "Global"
  creatorProfile: CreatorProfile | null;
  brandProfile: BrandProfile | null;
  isCreator: boolean;        // mirrors creatorProfile != null (denorm for queries)
  isBrand: boolean;          // mirrors brandProfile != null
  latestActivityAt: number;  // server-bumped on inbox activity (admin-only write)
  createdAt: number;
  updatedAt: number;
}

interface CreatorProfile {
  niches: string[];          // 0–6, max 24 chars each, lowercased
  portfolioUrl: string | null;
  socialLinks: SocialLink[]; // 0–16, deduped by (platform, handle)
  dmContact: DmContact | null;
}

interface BrandProfile {
  companyName: string;       // 1–60, REQUIRED
  industry: string | null;   // free string, validated against INDUSTRY_OPTIONS
  websiteUrl: string | null;
  dmContact: DmContact | null;
}

interface SocialLink {
  platform: "instagram" | "youtube" | "tiktok" | "twitter";
  handle: string;            // canonical, no @ prefix, no URL
}

interface DmContact {
  email: string | null;
  telegram: string | null;
  phone: string | null;
}
// Stored as null when every channel is empty (rules enforce no
// "all-null" object — directory queries assume null = closed).
```

**Rules summary:**
- Public read.
- Owner-only writes; specific field validators (length, regex, type).
- `walletAddress` is **append-only**: null → string, never overwritten.
- `isCreator` / `isBrand` must mirror sub-profile presence (rule-checked).
- Hard delete forbidden.

**Storage of denorms:** the writers in `profileService.ts` keep
`isCreator`/`isBrand` in lockstep. Directory queries depend on these
booleans — Firestore can't `!=` a map field.

### 5.2 `usernames/{slug}`

```ts
{ userId: string, createdAt: Timestamp }
```

- Doc id is the lowercase slug (regex `^[a-z0-9_]{3,20}$`).
- Public read (handle availability checks).
- Owner-only create/update/delete.
- Used by directory pages (`/creators/[handle]`, `/brands/[handle]`) to
  resolve a handle → uid → profile.
- **Username editing is intentionally not exposed in the UI** —
  renaming requires a transactional slug migration that's out of scope
  for v1.

### 5.3 `services/{id}` (creator's listings)

```ts
interface Service {
  kind: "service";
  id: string;
  sellerId: string;
  title: string;             // 1–80
  description: string;       // 1–1000
  category: ListingCategory; // "beauty"|"fitness"|"health"|"education"|"food"|"lifestyle"|"general"
  priceSol: number;          // > 0, ≤ 10000
  status: "active" | "paused" | "sold";
  ownerHandle: string | null;       // denorm at create — fields named sellerHandle/sellerDisplayName/sellerAvatarUrl in Firestore
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  mediaUrls: string[];       // ≤ 5 storage download URLs
  createdAt: number;
  updatedAt: number;
}
```

> **Field name mismatch:** the rules + Firestore docs store
> `sellerHandle`/`sellerDisplayName`/`sellerAvatarUrl`. The TS type
> normalizes to generic `ownerHandle`/`ownerDisplayName`/`ownerAvatarUrl`
> for the read layer. `listingsService.readService` does the mapping.
> Mirror it on mobile.

**Status state machine:** `active → paused | sold`. Hard delete forbidden
by rules — "delete from dashboard" is a status flip to `paused`.

**Rules:** active services public-read; paused/sold visible only to the
seller. Create requires the rule's full validation (status `active`,
price in range, title/description lengths, category enum, `mediaUrls`
≤ 5).

### 5.4 `gigs/{id}` (brand's open calls)

```ts
interface Gig {
  kind: "gig";
  id: string;
  brandId: string;
  title: string;
  description: string;
  category: ListingCategory;
  budgetSol: number;
  requirements: string;      // ≤ 1000
  status: "open" | "awarded" | "closed";
  ownerHandle: string | null;       // stored as brandHandle/brandDisplayName/brandAvatarUrl
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  mediaUrls: string[];
  createdAt: number;
  updatedAt: number;
}
```

Status state machine: `open → awarded | closed`. Same field-name
remapping convention as services.

When a gig moves out of `open`, the `cascadeApplicationsOnGigClose`
Cloud Function auto-rejects every still-pending application on it.

### 5.5 `gigApplications/{gigId}_{creatorId}`

```ts
type ApplicationStatus = "pending" | "shortlisted" | "awarded" | "rejected";

interface GigApplication {
  id: string;                // `${gigId}_${creatorId}` — DETERMINISTIC
  gigId: string;
  creatorId: string;
  status: ApplicationStatus;
  message: string;           // 1–1000
  sampleUrls: string[];      // ≤ 4
  // Denorm snapshots (best-effort at create time)
  gigTitle: string | null;
  brandId: string | null;
  brandHandle: string | null;
  brandDisplayName: string | null;
  creatorHandle: string | null;
  creatorDisplayName: string | null;
  creatorAvatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
}
```

**Why deterministic id?** Two parallel apply attempts by the same creator
hit the same doc id; the second falls under the rule's `update` branch
(brand-only) and is rejected. Free anti-double-apply guarantee.

**Status transitions:** `pending → shortlisted | awarded | rejected`,
brand-driven only. Rule limits update to `affectedKeys.hasOnly(['status',
'updatedAt'])` and forbids reverting to `pending`. The
`cascadeApplicationsOnGigClose` trigger may auto-flip `pending →
rejected` when the parent gig closes.

**On apply:** also creates an application thread (§5.7) seeded with the
pitch as the first message. Best-effort — the application stands even
if the thread create fails.

### 5.6 `orders/{orderId}`

```ts
type OrderStatus = "pending" | "paid" | "delivered" | "complete" | "failed";

interface Order {
  id: string;                // CLIENT-GENERATED uuid (so contractId32 can derive pre-write)
  buyerId: string;
  sellerId: string;
  status: OrderStatus;
  txSignature: string | null;       // append-only; the fund_service sig under v1 escrow
  amountSol: number;
  feeSol: number;            // protocol fee snapshot, in SOL
  contractId32: string | null;      // hex sha256(orderId); null on legacy direct-transfer orders
  escrowPda: string | null;         // base58 derived from (program, buyerWallet, contractId32)
  type: "service" | "gig";
  listingId: string;
  // Denorm
  listingTitle: string | null;
  buyerHandle: string | null;
  buyerDisplayName: string | null;
  sellerHandle: string | null;
  sellerDisplayName: string | null;
  createdAt: number;
  updatedAt: number;
}
```

**State machine** (rule-enforced):
```
pending → paid       (buyer claims payment + provides txSignature)
pending → failed     (buyer aborts)
paid    → delivered  (seller submits deliverable)
delivered → complete (buyer approves)
```

**Append-only fields:** `txSignature` once set cannot change.

**`affectedKeys` lock on update:** only `status`, `txSignature`,
`updatedAt` are mutable post-create. Denormalized snapshots and
`contractId32` / `escrowPda` must be written at create time or never.

**Submit/approve tx signatures** (the on-chain `submit_delivery` and
`approve_release` sigs) live on the corresponding **message** doc as
`escrowTxSignature`, not on the order doc — see §5.7.

**Reconciliation Cloud Function:** `reconcilePendingOrders` runs every 30
min and flips any order stuck in `pending` for >1 h to `failed`. The
client also has a `RecoverPendingOrders` component that replays
`markOrderPaid` from a localStorage breadcrumb (`adler.pendingOrders`)
on app boot — see §8.6.

### 5.7 `threads/{kind}_{parentId}` and `threads/{id}/messages/{messageId}`

```ts
type ThreadKind = "application" | "order";

interface Thread {
  id: string;                // `${kind}_${parentId}` — DETERMINISTIC
  kind: ThreadKind;
  parentId: string;          // gigApplications/{id} or orders/{id}
  parentTitle: string | null;
  participants: string[];    // exactly 2 uids
  participantSnapshots: Record<uid, { handle: string|null; displayName: string|null; avatarUrl: string|null }>;
  lastMessageAt: number;
  lastMessagePreview: string;       // ≤ 120 chars
  lastMessageSenderId: string | null;
  unreadCount: Record<uid, number>; // server-maintained except for self-zero
  createdAt: number;
  updatedAt: number;
}

type MessageKind = "text" | "deliverable" | "revision_request" | "approval" | "system";

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  kind: MessageKind;
  body: string;              // ≤ 2000
  attachments: string[];     // ≤ 5 storage download URLs
  createdAt: number;
  // Set only on deliverable + approval messages under v1 escrow
  escrowTxSignature: string | null;
  escrowTxConfirmedAt: number | null;
}
```

**Thread rules:**
- Read: any participant + any arbiter (for dispute review).
- Create: must include 2 distinct uids, kind in enum, `unreadCount`
  initialized to 0 for both.
- Client update: ONLY self-zero of `unreadCount[auth.uid]`. Everything
  else (`lastMessage*`, counterparty unread bump) is owned by the
  `onMessageCreate` Cloud Function (admin SDK bypasses rules).

**Message rules:**
- Read: same as thread.
- Create: senderId == auth.uid; participant; body ≤ 2000; attachments ≤ 5;
  kind in enum.
- Update / delete: forbidden. Append-only log (treated as evidence in
  disputes per whitepaper §9).

**Constants** (`lib/types/thread.ts`):
```
MESSAGE_BODY_MAX = 2000
MESSAGE_PREVIEW_MAX = 120
MESSAGE_ATTACHMENTS_MAX = 5
REVISION_CAP = 2
```

### 5.8 `reviews/{orderId}_{reviewerId}`

```ts
const RATING_AXES = ["scope", "communication", "timeliness", "quality"] as const;
type RatingAxis = typeof RATING_AXES[number];
type RatingAxes = Record<RatingAxis, number>; // each 1..5

interface Review {
  id: string;                // `${orderId}_${reviewerId}`
  orderId: string;
  reviewerId: string;
  revieweeId: string;
  axes: RatingAxes;
  comment: string;           // ≤ 500
  amountSol: number;         // pinned to parent order at write time
  listingId: string;         // pinned to parent order at write time
  createdAt: number;
}
```

**Rules:** public read; create only when the parent order is `complete`
and the caller is one of the two parties. `revieweeId !== reviewerId`.
`amountSol` and `listingId` MUST mirror the parent order (rule-checked
via `get(/orders/...)`). Update limited to `axes` + `comment`.

**Aggregate** (`lib/services/reviewsService.ts:aggregate`):
```
overall = Σ(meanOfAxes(r) × r.amountSol) / Σ(r.amountSol)
perAxis[a] = Σ(r.axes[a] × r.amountSol) / Σ(r.amountSol)
```
Falls back to a simple mean if every review has `amountSol === 0`.

### 5.9 `disputes/{orderId}` (deterministic id == orderId)

```ts
type DisputeStatus = "open" | "resolved";
type DisputeOutcome = "release_to_creator" | "refund_to_brand" | "split";
type DisputeFiledBy = "buyer" | "seller";

interface Dispute {
  id: string;                // == orderId — one dispute per order
  orderId: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  threadId: string;          // `order_{orderId}` — deep-link target
  filedBy: DisputeFiledBy;
  reason: string;            // 1–2000
  status: DisputeStatus;
  outcome: DisputeOutcome | null;
  outcomeNote: string;       // ≤ 2000, set on resolve
  splitPercentToCreator: number | null;  // 0..100 when outcome === "split"
  resolvedBy: string | null; // arbiter uid
  resolvedAt: number;
  amountSol: number;         // pinned to parent order
  createdAt: number;
  updatedAt: number;
}
```

**Filing rules:**
- Caller is buyer or seller.
- Order in `paid` or `delivered` (not `complete`).
- `buyerId`/`sellerId`/`amountSol`/`listingId` must mirror the parent
  order verbatim (rule-checked).
- Doc id == orderId → second filing race rejected automatically (falls
  under the rule's update branch, which is arbiter-only).

**Resolution:** arbiter-only (`roles/{uid}.role === "arbiter"`).
`affectedKeys.hasOnly(['status','outcome','outcomeNote',
'splitPercentToCreator','resolvedBy','resolvedAt','updatedAt'])`.

**Pending-settlement copy:** outcomes that need on-chain fund movement
(`refund_to_brand`, `split`) display "Settlement pending the on-chain
escrow program" until the Anchor program ships those flows. The constant
`PENDING_SETTLEMENT` in `lib/types/dispute.ts` drives this.

### 5.10 `notifications/{auto}`

```ts
type NotificationKind =
  | "application_received" | "application_decided" | "order_state"
  | "thread_message" | "dispute_filed" | "dispute_resolved" | "system";

interface AdlerNotification {
  id: string;
  recipientId: string;
  kind: NotificationKind;
  title: string;             // ≤ 120
  body: string;              // ≤ 240
  href: string;              // deep-link path (e.g. `/inbox/order_xyz`)
  read: boolean;
  refs: { orderId?, threadId?, applicationId?, listingId?, disputeId? };
  createdAt: number;
}
```

**Server-only writer.** Rules:
- Recipient can read their own.
- Recipient can update with `affectedKeys.hasOnly(['read'])` and `read === true`.
- Create / delete: forbidden for clients.

**Cloud Functions that write here** (admin SDK bypasses rules):
- `notifyApplicationReceived` — application created → ping brand
- `notifyApplicationDecided` — status flip → ping creator
- `notifyOrderStateChanged` — order status flip → ping counterparty
- `onMessageCreate` — new message → ping counterparty (skips `system`
  messages since the actor already triggered them)
- `notifyDisputeFiled` — dispute opened → ping counterparty + every arbiter
- `notifyDisputeResolved` — dispute closed → ping both parties

Each fans out an **Expo push notification** in addition to the in-app
row, using the recipient's `profiles/{uid}.pushToken`. **The mobile app
must write its Expo push token to that field on first run** — that's
how all five push triggers reach the device.

### 5.11 `preferences/{uid}` (per-user notification toggles)

```ts
type NotificationPreferences = Record<NotificationKind, boolean>;

interface UserPreferences {
  uid: string;
  notifications: NotificationPreferences;
  updatedAt: number;
}
```

Owner read+write. **Default (no doc) = everything on.** Both the in-app
read path and the email Cloud Function honour this. v1 prefs gate both
in-app and email channels with one boolean per kind. Mobile push prefs
will land in a follow-up — for now, push fan-out is **not** gated on
preferences (the Cloud Function comment notes this explicitly).

UI grouping for the prefs page is in `lib/types/preferences.ts ::
NOTIFICATION_KIND_GROUPS` — five groups (Orders / Messages /
Applications / Disputes / System). Use it verbatim.

### 5.12 `roles/{uid}` (arbiter provisioning)

```ts
interface Role { uid: string; role: "arbiter"; createdAt: number; }
```

Public read so clients can `exists()`/`get()` to gate the admin panel.
**Writes are admin-only** — provision via `firebase firestore:set
roles/<uid> '{"role":"arbiter"}'`. No UI for assignment.

`useIsArbiter()` hook returns `{ ready: bool, isArbiter: bool }` — use
the tri-state to render `loading` / `403` / `panel`.

### 5.13 `mail/{auto}` (email outbox — DO NOT TOUCH)

Server-only write by the `onNotificationCreateEmail` Cloud Function.
Read by the `firestore-send-email` Firebase extension. Clients are
denied entirely.

### 5.14 `saves/{userId_kind_listingId}` (bookmarks)

```ts
{ userId: string, kind: "service" | "gig", listingId: string, createdAt: Timestamp }
```

Owner-only read/create/delete. Doc id is deterministic so a tampered
client can't masquerade saves under another user. The mobile app
already has `hooks/useSaves.ts` and `app/(home)/(tabs)/saved.tsx` — keep
this primitive; the web doesn't currently surface it but the rule and
indexes are deployed.

---

## 6. Onboarding flow (porting target)

```
sign-in (Google OAuth via Privy)
  └─ on success, Privy mints embedded Solana wallet
     └─ AuthContext bridges to Firebase via mintFirebaseToken
        └─ UserContext runs ensureProfileExists
           └─ first time?  ─yes─►  intro (3 slides, persisted via onboarding_seen flag)
                                    └─ /browse (default landing)
                          ─no──►   /browse
```

**Three-slide intro** (`app/(app)/(auth)/intro/page.tsx`):

1. **Welcome to Adler** — "A two-sided marketplace where creators sell
   content services and brands post gigs. Settled directly on Solana."
2. **Your wallet, ready to go** — "Adler creates an embedded Solana
   wallet for you on first sign-in. You hold the keys; we just route
   payments."
3. **Test SOL, no real funds** — "Adler runs on devnet during the beta.
   Top up free test SOL via the Solana CLI from the Wallet screen any
   time."

Slide carousel with skip on slides 1–2, "Get started" on slide 3.
Persists `onboarding_seen=true` to localStorage on finish.

**Profile gating after intro:** `/browse` opens behind a soft
`<ProfileGate require="any">` wrapper. If the user has neither a
creator nor brand sub-profile filled in, an inline dialog blurs the
page and asks them to set up at least one side. Role-locked routes
(`/services`, `/wallet`, `/applicants`, `/applications`, `/spend`)
use `<ProfileGate require="creator">` or `<ProfileGate
require="brand">`. The sidebar stays interactive while gated so the
user can sign out / navigate elsewhere.

> **Mobile angle:** the existing `role-select.tsx` screen achieves the
> same goal earlier. Keep it if you want — but the *gating still has
> to exist on every role-locked screen*, since users can have **both**
> sides or **neither** (they can also clear a side later from
> settings). Don't rely on a one-time role pick.

---

## 7. Service layer — the API the mobile app must rebuild

Every collection has exactly one service module that owns all
Firestore I/O. Components never import `firebase/firestore` directly.
What follows is the full surface area, port-ready.

### 7.1 `profileService` (`lib/services/profileService.ts`)

```ts
getProfile(userId): Profile | null
ensureProfileExists(userId, walletAddress): Profile  // tx; idempotent
updateProfileBasics(userId, { displayName?, bio? }): void
setCountry(userId, country: string | null): void
setAvatarUrl(userId, avatarUrl: string | null): void
updateCreatorProfile(userId, patch: Partial<CreatorProfile> | null): void
updateBrandProfile(userId, patch: Partial<BrandProfile> | null): void
USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/
```

**`updateCreatorProfile`/`updateBrandProfile` quirks:**
- Pass `null` to clear the side entirely (sets sub-profile to null **and**
  flips `isCreator`/`isBrand` to false).
- Otherwise reads existing, merges patch, dedupes social links by
  (platform, handle), normalizes `dmContact` (collapses to null if all
  channels blank), and writes the merged sub-profile **plus** flips
  `isCreator`/`isBrand` to true.
- Mobile push token: write via `updateDoc(profileRef, { pushToken })`
  inline — there's no dedicated helper on web (mobile-only concern).
  Firestore rule: ≤ 256 chars, nullable.

**Username generation** (only fires inside `ensureProfileExists` first
write):
```
const ADJECTIVES = ["Lunar","Solar","Crimson","Indigo","Velvet","Neon","Quartz","Onyx","Coral","Mirage","Echo","Drift","Vapor","Ember","Nova","Cipher"];
const NOUNS = ["Studio","Lab","Atelier","Forge","Loft","Press","Foundry","Frame","Reel","Lens","Pulse","Wave","Cell","Crew","Field","Range"];
username = `${pick(ADJECTIVES)}${pick(NOUNS)}${userId.slice(-4)}`.toLowerCase();
displayName = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
```
Probability of slug collision is essentially zero with the userId tail.

### 7.2 `listingsService` (`lib/services/listingsService.ts`)

```ts
listListings({ kind, category?, cursor?, pageSize=20 }): { items, nextCursor }
listMyListings(kind, uid): Listing[]
getListing(kind, id): Listing | null

createService({ title, description, category, priceSol, ownerHandle, ownerDisplayName, ownerAvatarUrl, mediaUrls? }): id
createGig({ title, description, category, budgetSol, requirements, ownerHandle, ownerDisplayName, ownerAvatarUrl, mediaUrls? }): id

updateService(id, patch: Partial<{ title, description, category, priceSol, status, mediaUrls }>): void
updateGig(id, patch: Partial<{ title, description, category, budgetSol, requirements, status, mediaUrls }>): void

archiveService(id): void   // status flip → 'paused'
archiveGig(id): void       // status flip → 'closed'

// Pure helpers (client-side over the fetched page)
applyListingFilter(items, query): Listing[]   // case-insensitive across title/description/owner
applyListingSort(items, sort: ListingSort): Listing[]  // newest|oldest|price_low|price_high
```

**Sort modes** (`lib/types/listing.ts`):
```
LISTING_SORTS = ["newest","oldest","price_low","price_high"]
LISTING_SORT_LABEL = { newest:"Newest", oldest:"Oldest", price_low:"Price: low to high", price_high:"Price: high to low" }
```

**Categories** (rule-pinned enum):
```
LISTING_CATEGORIES = ["beauty","fitness","health","education","food","lifestyle","general"]
```

Search is **client-side substring** over the fetched page — fine until
~1k listings per category. Past that, swap to Algolia or composite
indexes on tokenized title fields.

### 7.3 `applicationsService`

```ts
applicationIdFor(gigId, creatorId): string   // `${gigId}_${creatorId}`
listApplicationsByCreator(uid): GigApplication[]
listApplicationsByBrand(uid): GigApplication[]
hasCreatorAppliedToGig(creatorId, gigId): boolean   // single-doc lookup
createApplication({ gigId, message, sampleUrls?, gigTitle?, brandId?, brandHandle?, brandDisplayName?, creatorHandle?, creatorDisplayName?, creatorAvatarUrl? }): id
setApplicationStatus(id, status): void   // throws if status === "pending"
```

**Apply flow** is two writes:
1. `createApplication(...)` — `setDoc` against the deterministic id; race
   safety from the rule.
2. `createApplicationThread({ applicationId, gigTitle, creator, brand,
   pitchBody })` — best-effort; the application stands even if thread
   creation fails.

### 7.4 `ordersService`

```ts
createOrder({ orderId, contractId32, escrowPda, sellerId, amountSol, feeSol, type, listingId, listingTitle, buyerHandle, buyerDisplayName, sellerHandle, sellerDisplayName }): id
markOrderPaid(orderId, txSignature): void   // pending → paid
markOrderFailed(orderId): void              // pending → failed
getOrder(orderId): Order | null
listOrdersAsBuyer(uid): Order[]
listOrdersAsSeller(uid): Order[]

// Pure aggregators
feeHistoryStats(asBuyer, asSeller): { totalFeeSol, totalContractSol, last30FeeSol, settledCount }
spendStats(orders): { totalSettled, totalSettledCount, last30, last30Count, inFlight, inFlightCount }
```

**Order id is client-generated** (`crypto.randomUUID()`) so the
`contractId32 = sha256(orderId)` and `escrowPda = pda(program,
buyerWallet, contractId32)` can be persisted at create time. Adding
either field after create is rule-blocked.

`paid → delivered` and `delivered → complete` are **atomic with the
message log entry** via `writeBatch` inside `threadsService`
(`submitDeliverable` / `approveDeliverable`). Don't replicate that
batch as separate `markOrderDelivered` / `markOrderComplete` writers
— the rule's order-update branch isn't designed to be called from
two places.

### 7.5 `threadsService`

```ts
threadIdFor(kind: "application" | "order", parentId: string): string  // `${kind}_${parentId}`

createApplicationThread({ applicationId, gigTitle, creator: {uid,handle,displayName,avatarUrl}, brand: {…}, pitchBody? }): id
createOrderThread({ orderId, parentTitle, buyer: {uid,…}, seller: {…} }): id

listMyThreads(uid): Thread[]   // participants array-contains, ordered by lastMessageAt desc
getThread(threadId): Thread | null
listMessages(threadId): Message[]  // last 100, oldest→newest
sendMessage({ threadId, kind?, body, attachments? }): id
markThreadRead(threadId): void

submitDeliverable({ threadId, orderId, body, attachments?, escrowTxSignature? }): void  // batched: append message + flip order paid→delivered
requestRevision({ threadId, body }): void   // single revision_request message
approveDeliverable({ threadId, orderId, body?, escrowTxSignature? }): void  // batched: append message + flip order delivered→complete

// Pure helper
countRevisionRequests(messages): number
```

**Self-zero unread:** `markThreadRead` does `updateDoc(thread, {
unreadCount.${uid}: 0 })`. The rule allows exactly that mutation; the
Cloud Function bumps the counterparty back up on each new message.

**Composer UX rules** (web): Enter sends, Shift+Enter newlines. Map to
RN as appropriate (probably keep Send button + Return = newline on
mobile).

### 7.6 `reviewsService`

```ts
reviewIdFor(orderId, reviewerId): string
submitReview({ orderId, revieweeId, axes, comment? }): id   // setDoc; create or edit
getReviewByReviewer(orderId, reviewerId): Review | null
listReviewsByReviewee(uid): Review[]
listReviewsByListing(listingId): Review[]
aggregate(reviews): { count, totalSol, overall, perAxis }
```

Edit path is permitted by the rule (only `axes` + `comment` mutable).
Submit is gated client-side on `order.status === "complete"` and the
caller being a participant — but the rule re-checks both via `get()`,
so a buggy client can't slip past.

### 7.7 `disputesService`

```ts
getDispute(disputeId): Dispute | null
getDisputeByOrder(orderId): Dispute | null    // disputeId === orderId
fileDispute({ orderId, reason }): id           // setDoc against orderId
resolveDispute({ disputeId, outcome, outcomeNote, splitPercentToCreator? }): void  // arbiter-only
listOpenDisputes(): Dispute[]
listResolvedDisputes(): Dispute[]
listDisputesByParticipant(uid): Dispute[]      // union of buyer+seller queries, deduped
disputeStats(disputes, uid): { total, asBuyer, asSeller, releaseCount, refundCount, splitCount, openCount }
```

**Pre-flight checks `fileDispute` does client-side** (rules re-enforce
on the server):
- order exists
- order in `paid` or `delivered`
- caller is buyer or seller
- derives `filedBy` from caller identity

### 7.8 `notificationsService`

```ts
listMyNotifications(uid): AdlerNotification[]   // last 100, createdAt desc
markNotificationRead(id): void
markAllRead(notifications): void                 // parallel; per-doc, since the rule rejects batched cross-doc updates
```

The rule's update branch is `affectedKeys.hasOnly(['read']) && read ===
true`. No "mark unread", no edits, no deletes.

### 7.9 `preferencesService`

```ts
getPreferences(uid): UserPreferences   // missing doc → DEFAULT_PREFERENCES (everything on)
setNotificationPreference(uid, kind, value): void   // dotted-path setDoc; merge:true
```

The dotted path lets one toggle update one key without read-modify-write.

### 7.10 `rolesService`

```ts
getRole(uid): Role | null
useIsArbiter(): { ready: boolean, isArbiter: boolean }   // React Query hook
```

### 7.11 `directoryService` (public profile listings)

```ts
listBrands({ industry?, cursor?, pageSize=20 }): { items: BrandListing[], nextCursor }
listCreators({ niche?, cursor?, pageSize=20 }): { items: CreatorListing[], nextCursor }
getBrandByHandle(handle): Profile | null    // resolves usernames/{handle} → uid → profile, returns null if no brandProfile
getCreatorByHandle(handle): Profile | null
```

**`BrandListing`** (narrowed projection):
```ts
{ id, username, displayName, avatarUrl, country, companyName, industry, hasDmContact, latestActivityAt }
```

**`CreatorListing`**:
```ts
{ id, username, displayName, avatarUrl, country, niches, hasDmContact, latestActivityAt }
```

Queries depend on the `isBrand`/`isCreator` denormalized flags + the
composite indexes deployed in `firestore.indexes.json`:
- `(isBrand=true, updatedAt desc)`
- `(isBrand=true, brandProfile.industry==X, updatedAt desc)`
- `(isCreator=true, updatedAt desc)`
- `(isCreator=true, creatorProfile.niches array-contains X, updatedAt desc)`

### 7.12 `imageUploadService` / `listingMediaUploadService` / `messageMediaUploadService`

| Service | Path | Caps | Allowed types |
|---|---|---|---|
| `imageUploadService` | `profilePictures/{uid}.jpg` | 2 MB | `image/jpeg` only |
| `listingMediaUploadService` | `services/{uid}/{uuid}.{ext}` or `gigs/{uid}/{uuid}.{ext}` | 50 MB | jpg/png/webp + mp4/webm/mov |
| `messageMediaUploadService` | `threads/{threadId}/{messageId}/{uuid}.{ext}` | 25 MB | same as listing media |

```ts
uploadProfilePicture(uid, blob): downloadURL
uploadListingMedia(kind: "service"|"gig", uid, file): { url, path, contentType, kind: "image"|"video" }
uploadMessageMedia(threadId, messageId, file): { url, path, contentType }
```

The Storage rules enforce all of the above server-side; the client
helpers fail-fast for friendly errors.

> **RN note:** `uploadBytes` works in RN against `Blob` and
> `Uint8Array` after `expo-file-system` reads the file. For listing
> video, transcode/compress before upload to stay under 50 MB.

### 7.13 `privyAuthService`

Already documented in §4.3. Three exports:

```ts
bridgeToFirebase(privyAccessToken): uid
signOutOfFirebase(): void
deleteAccount(): void   // calls deleteUserAccount Cloud Function
```

---

## 8. Solana / Anchor escrow (the big new thing)

This is what makes Adler a marketplace and not a chat app. The web is
mid-migration: services have been wired to the on-chain escrow program;
gigs (fund-at-post + bind-on-award) are next. Mobile should land on the
same target as web — direct-transfer is **legacy**.

### 8.1 Wallet (Privy embedded, Solana-only)

Every Adler account auto-provisions an embedded Solana wallet on first
Privy sign-in (`createOnLogin: "users-without-wallets"`,
`walletChainType: "solana-only"`).

The wallet pubkey (base58) is mirrored into `profiles/{uid}.walletAddress`
on first sign-in by `ensureProfileExists`. The field is **append-only**
— other users find it via the profile and pay it directly.

For accounts that pre-date the embedded-wallet flag (rare), the web
exposes a `<CreateSolanaWalletButton>` on `/wallet`. Mobile probably
doesn't need this — Privy mobile defaults to embedded.

### 8.2 Connection (`lib/solana/connection.ts`)

```ts
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "@/lib/constants/featureGates";

let connection: Connection | null = null;
export function getConnection(): Connection {
  if (!connection) connection = new Connection(SOLANA_RPC_URL, "confirmed");
  return connection;
}

export const solToLamports = (sol: number): number => Math.round(sol * LAMPORTS_PER_SOL);
export const lamportsToSol = (lamports: number): number => lamports / LAMPORTS_PER_SOL;

export const RENT_BUFFER_SOL = 0.001;
export const NETWORK_FEE_RESERVE_SOL = 0.00001;
```

Singleton. RPC URL comes from `featureGates.SOLANA_RPC_URL`, which
defaults to the Cloud Function proxy.

### 8.3 Read helpers

```ts
getSolBalance(address): number   // SOL, not lamports
getRecentActivity(address, limit=20): WalletActivityItem[]
//   { signature, blockTime, status, direction: "in"|"out"|"self"|"other", netSol, feeSol, counterparty }
requestAirdrop(address, amountSol=1): { signature, confirmed }   // throws if !IS_DEVNET_LIKE
getSolUsdPrice(): number          // CoinGecko, with 24h stale-while-error fallback in localStorage
```

`getRecentActivity` parses last N transactions, computes net SOL delta
for the user (excluding fee they paid as fee payer), best-effort
counterparty by matching inverse balance moves.

### 8.4 Send (direct transfer — keep for the wallet "Send" UX)

```ts
transferSol({ wallet, toAddress, amountSol }): signature
```

`wallet` is `ConnectedStandardSolanaWallet` from
`@privy-io/react-auth/solana`. Validates fresh balance (avoids closing
the system account by leaving it below rent-exempt).

Build a `Transaction` with one `SystemProgram.transfer` ix, serialize,
and call `wallet.signAndSendTransaction({ transaction, chain:
SOLANA_CHAIN_ID })`. Result `.signature` is `Uint8Array`; encode with
`bs58`.

**Wallet "Send" page on mobile:** dialog collects address (validate via
`new PublicKey()`), amount, reserves `RENT_BUFFER_SOL` (0.001 SOL),
calls `transferSol`. Toast with `txExplorerUrl(signature)` action.

### 8.5 The Anchor escrow program (`../adler-program/`)

**Program ID (devnet):** `BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr`

**PDAs** (`lib/anchor/pda.ts` — keep in lockstep with Rust):

```
config        = pda(["config"], programId)               // ProtocolConfig singleton
arb_pool      = pda(["arb_pool"], programId)
contract      = pda(["contract", brand, contract_id], programId)  // escrow lamport vault
record        = pda(["record",   brand, contract_id], programId)  // settled record
rep_card      = pda(["rep",      subject, contract_id], programId)
```

**`contract_id`** is `sha256(orderId)` — 32 bytes, no truncation. Rust
uses `solana_program::hash::hashv`, identical to standard SHA-256 over
the same UTF-8 bytes. There's a fixture test (`pda.test.ts`) that pins
both digest + PDA output to catch drift.

```ts
deriveContractId(offChainId): Uint8Array              // 32 bytes
deriveProtocolConfigPda(programId): PublicKey
deriveArbitrationPoolPda(programId): PublicKey
deriveContractEscrowPda(programId, brand, contractId): PublicKey
deriveContractRecordPda(programId, brand, contractId): PublicKey
deriveReputationCardPda(programId, subject, contractId): PublicKey
contractIdToHex(bytes): string
contractIdFromHex(hex): Uint8Array
```

**Anchor handle** (`lib/anchor/program.ts`): a singleton
`Program<AdlerEscrow>` built from a dummy keypair (Anchor's
`AnchorProvider.Wallet` contract requires *some* signer). We **never**
use that wallet to sign — only `program.methods.X().instruction()` to
build IXs and `program.account.Y.fetch(pda)` to decode state.

**Sign + send** (`lib/escrow/_send.ts`): builds a `Transaction`,
serializes, calls `wallet.signAndSendTransaction`, confirms to
`"confirmed"`, parses Anchor error codes from logs (`FeeTreasuryMismatch`,
`WrongState`, etc.) and throws `EscrowError { code, cause, signature }`.

### 8.6 The buy flow (services — production today)

`components/app/listings/BuyAction.tsx` walks this dance. Mobile must
mirror it exactly.

```ts
1. Pre-flight balance check (fresh `getSolBalance` — cached value can flip stale)
2. orderId = crypto.randomUUID()
3. contractId = deriveContractId(orderId)
4. escrowPda = deriveContractEscrowPda(V1_PROGRAM_ID, buyerWallet, contractId)
5. createOrder({ orderId, contractId32: hex(contractId), escrowPda: escrowPda.toBase58(), … })
6. setPendingOrder(orderId, { signature: null, ts: Date.now() })   // localStorage breadcrumb
7. const { signature } = await fundService({ orderId, priceSol, brandWallet, creatorPubkey })
8. setPendingOrder(orderId, { signature, ts: Date.now() })
9. createOrderThread({ orderId, parentTitle, buyer, seller })   // best-effort
10. retryWithBackoff(() => markOrderPaid(orderId, signature), { tries: 3, baseMs: 500 })
    └─ on exhaustion: leave breadcrumb, toast "finalizing in background", let RecoverPendingOrders pick it up next boot
11. clearPendingOrder(orderId)
12. invalidate query cache: balance, activity, orders.byBuyer, threads
```

**Catch path:** if anything throws before we have a signature, mark the
order failed and clear the breadcrumb. If we have a signature but no
Firestore mark, **don't** mark failed — the on-chain settlement
already happened.

**`fundService`** (`lib/escrow/fundService.ts`): builds `fund_service`
ix with accounts `{ config, escrow, brand, creator, systemProgram }`,
signs via Privy wallet, returns `{ signature, contractId32Hex,
escrowPda }`.

The on-chain program stamps `escrow.fee_lamports` from the
`ProtocolConfig` settings; the client mirror writes
`feeSol = computeFeeSol(priceSol)` to keep billing roll-ups consistent
without an account fetch.

### 8.7 Submit delivery (creator, on `paid` orders)

```ts
1. Open DeliverableDialog (text + ≤ 5 attachments)
2. submitDelivery({ contractIdHex, brandWalletAddress, creatorWallet }) → signature
   └─ buys the buyer's wallet from the order doc → getProfile(order.buyerId).walletAddress
3. submitDeliverable({ threadId, orderId, body, attachments, escrowTxSignature: signature })
   └─ batched Firestore: append `deliverable` message + flip order paid→delivered
```

If the chain rejects (`WrongState` — already submitted), no Firestore
write happens. The toast surfaces the error; user retries or the chain
state is already past `Bound` (in which case the message log doesn't
lie about it).

### 8.8 Approve & complete (buyer, on `delivered` orders)

```ts
1. Open ConfirmDialog ("Approve and complete? This is final.")
2. approveRelease({ contractIdHex, brandWallet, creatorPubkey }) → { signature: string | null }
   └─ pre-flight: getAccountInfo(escrowPda). If null, escrow already closed → idempotent return null
   └─ on FeeTreasuryMismatch: re-fetch fee_treasury and retry once
3. approveDeliverable({ threadId, orderId, escrowTxSignature: signature ?? undefined })
   └─ batched Firestore: append `approval` message + flip order delivered→complete
4. Auto-open RatingDialog (buyer's prompt fires here)
```

`approveRelease` accounts: `{ config, escrow, record, brand, creator,
feeTreasury, systemProgram }`. Releases `price` to creator and
`fee_lamports` to the fee treasury, closes the escrow PDA, rent back to
brand.

### 8.9 Revisions

Buyer-side, `delivered` orders, capped at `REVISION_CAP = 2`. The third
click swaps the CTA to "Open dispute". `requestRevision({ threadId,
body })` writes a single `revision_request` message — no order status
change (the order stays in `delivered` per the v1 escrow rules; the
seller resubmits with another `submit_delivery` ix flipping the chain
state back to Bound… eventually. Today the rule's order state machine
doesn't roll back, so revisions are message-log only).

`countRevisionRequests(messages)` is a pure helper.

### 8.10 Recover-pending-orders boot job

`components/app/orders/RecoverPendingOrders.tsx` is mounted in the home
layout. On boot:
1. Read `adler.pendingOrders` from localStorage.
2. For each entry: if `signature` is set, replay
   `markOrderPaid(orderId, signature)` (idempotent under the rule).
3. If no signature but the entry is recent, `getAccountInfo(escrowPda)`
   to detect "funded but unrecorded" — the buy completed on-chain but
   the tab died before `markOrderPaid` landed.
4. Clear the breadcrumb on success.

Mobile equivalent: same job on app cold start, AsyncStorage instead of
localStorage.

### 8.11 What's NOT shipped on-chain yet

From `TODO.md` (web side) — flag for the mobile agent:
- Gig fund-at-post (`fundGig`) + bind-on-award (`bindCreator`) — coming
- Brand refund after delivery deadline — coming
- On-chain dispute filing/arbitration — coming
- On-chain reputation cards — coming

For now, the mobile UI shows "Settlement pending the on-chain escrow
program" badges on dispute outcomes that need fund movement
(`refund_to_brand`, `split`). Use the `PENDING_SETTLEMENT` constant.

### 8.12 Constants (`lib/constants/escrow.ts`)

```ts
V1_PROGRAM_ID = new PublicKey("BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr")
APPROVAL_WINDOW_SECS_DEFAULT = 72 * 3600   // 72 hours sentinel; real value lives on ProtocolConfig
```

`lib/constants/featureGates.ts`:

```ts
SOLANA_NETWORK: "devnet" | "mainnet-beta" | "testnet"
SOLANA_RPC_URL: string                     // Cloud Function proxy by default
SOLANA_CHAIN_ID: "solana:devnet" | "solana:mainnet" | "solana:testnet"
PROTOCOL_FEE_BPS = 50                      // 0.50%
PROTOCOL_FEE_RATE = 0.005
computeFeeLamports(totalLamports): number  // floor((total * 50) / 10000)
computeFeeSol(amountSol): number
FEE_TREASURY_ADDRESS: string               // env-driven; hard-fails in production builds without it
```

---

## 9. State management

### 9.1 React Query

Single `QueryClient`, options:
```ts
{
  queries: {
    staleTime: 5 * 60 * 1000,    // 5 min
    gcTime: 30 * 60 * 1000,      // 30 min
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
    networkMode: "offlineFirst",
  },
  mutations: { retry: 1, networkMode: "offlineFirst" },
}
```

Wallet-style queries override staleTime tighter (15–60 s) and
`refetchOnWindowFocus: true`. Inbox unread shares the same query key
across the inbox page and the sidebar badge so a single fetch serves
both.

### 9.2 Query key factory (`lib/constants/queryKeys.ts`)

```ts
qk.profiles.detail(uid)
qk.listings.list(kind, category|null)
qk.listings.detail(kind, id)
qk.listings.byOwner(kind, uid)
qk.applications.byCreator(uid)
qk.applications.byBrand(uid)
qk.orders.all()
qk.orders.detail(id)
qk.orders.byBuyer(uid)
qk.orders.bySeller(uid)
qk.threads.byParticipant(uid)
qk.threads.detail(id)
qk.threads.messages(id)
qk.reviews.byReviewee(uid)
qk.reviews.byListing(id)
qk.reviews.myForOrder(orderId, uid)
qk.notifications.list(uid)
qk.disputes.detail(id)
qk.disputes.byOrder(orderId)
qk.disputes.open()
qk.disputes.resolved()
qk.disputes.byParticipant(uid)
qk.roles.detail(uid)
qk.preferences.detail(uid)
qk.brands.list(industry|null)
qk.brands.byHandle(handle)
qk.creators.list(niche|null)
qk.creators.byHandle(handle)
qk.wallet.balance(address)
qk.wallet.activity(address)
qk.wallet.solUsd()
qk.escrow.protocolConfig()
qk.escrow.contractEscrow(orderId)
```

Use these verbatim. Blanket invalidation works because each domain is
namespaced under its plural collection root.

### 9.3 Contexts

| Context | Provides | Mounted in |
|---|---|---|
| `QueryProvider` | TanStack QueryClient | App root |
| `AuthProvider` | `{ user, privyUserId, walletAddress, isReady, isBridging, isConnected, signOut, runIfOnline }` | After QueryProvider |
| `UserProvider` | `{ profile, loading, isCreator, isBrand, hasAnyProfile, refreshProfile }` | After AuthProvider |
| `ViewModeProvider` | `{ viewMode, setViewMode, availableModes }` | After UserProvider |
| `DirtyFormsProvider` | unsaved-form guard | Inside home layout (only) |

`ViewModeContext` snaps to the available mode if the user has only one
side set up, but preserves the user's underlying preference so
restoring the missing side flips them back. Persisted via
`localStorage[VIEW_MODE]` (mobile: AsyncStorage).

`DirtyFormsContext` is **only** used on settings/profile. Skip it on
mobile if simpler to manage edits inline.

### 9.4 Storage keys (`lib/constants/storageKeys.ts`)

```ts
STORAGE_KEYS = {
  CACHED_PROFILE: "cached_profile",   // stale-while-revalidate profile cache, scoped to uid
  ONBOARDING_SEEN: "onboarding_seen", // intro flag
  VIEW_MODE: "view_mode",             // creator | brand
}
```

Plus app-internal:
```ts
"adler.solUsd"           // 24h stale-while-error price cache
"adler.pendingOrders"    // buy-flow recovery breadcrumbs
```

---

## 10. Routes / screens

Web tree (`app/(app)/`) → mobile equivalent. The mobile shell is a
4-tab tabbar (`browse`, `inbox`, `profile`, `saved`) — modal-style
detail screens push from there.

### 10.1 Auth flow

| Web | Mobile target | Purpose |
|---|---|---|
| `/sign-in` | `(auth)/sign-in` ✅ | Google OAuth via Privy. After success, route to `/intro` (first time) or `/browse` |
| `/intro` | `(auth)/intro` ✅ | 3 slides; persist `onboarding_seen` |
| `/app` (entry router) | `app/index.tsx` ✅ | Branch based on auth state + intro flag |

### 10.2 Browse tab (`/browse`)

Wrapped in `<ProfileGate require="any">`. Role-aware default feed:
- Creator view → list **gigs** ("Find offers. Get paid.")
- Brand view → list **services** ("Creators open for hire")

Controls: search input (case-insensitive substring), category filter
chips (7 categories), sort dropdown (4 sorts).

Server query is `listListings({ kind, category })` paged at 20 items;
search + sort run client-side over the fetched page.

### 10.3 Detail screens (deep-linkable)

| Web route | Mobile route | What it shows |
|---|---|---|
| `/services/[id]` | `service/[id]` (rename from `package/[id]`) | Service detail; for brand viewers a Buy CTA |
| `/gigs/[id]` | `gig/[id]` ✅ | Gig detail; for creator viewers an Apply CTA |
| `/services/[id]/edit` | new | Owner-only edit form |
| `/gigs/[id]/edit` | new | Owner-only edit form |
| `/services/new` | inline dialog from services list | Authoring dialog (URL-bound `?new=1` on web) |
| `/gigs/new` | new | Brand-only gig authoring |
| `/creators/[handle]` | `profile/[id]` (resolve handle → uid) ✅ | Public creator profile + reputation block + dispute outcomes |
| `/brands/[handle]` | same | Public brand profile |

### 10.4 Inbox tab

| Web | Mobile target |
|---|---|
| `/inbox` | `(tabs)/inbox` ✅ — list of threads, sorted by `lastMessageAt`, unread badge per row |
| `/inbox/[threadId]` | new modal/stack screen |

**Thread detail screen** is the most complex screen in the app. See
§12 for the full state machine.

### 10.5 Role-locked screens

Wrapped in `<ProfileGate require="creator">` or `<ProfileGate
require="brand">` — page renders behind a blurred dialog if the
required side is missing.

| Web | Role | Mobile target |
|---|---|---|
| `/services` | creator | new — own services list + create dialog (URL-bound `?new=1`) |
| `/applications` | creator | new — pitches I've sent, status-tab filter |
| `/wallet`, `/wallet/sales`, `/wallet/purchases` | creator | new — wallet page with send/receive/airdrop + sales/purchases tabs |
| `/applicants` | brand | new — brand inbox of applications across own gigs |
| `/spend` | brand | new — KPI dashboard (settled, last 30d, in-flight, recent purchases) |
| `/admin/disputes`, `/admin/disputes/[id]` | arbiter | optional — gated by `useIsArbiter()` |

### 10.6 Notifications

| Web | Mobile |
|---|---|
| `/notifications` | new — long-form feed, mark-all-read |
| Sidebar bell popover (last 8) | tabbar badge or header icon |

### 10.7 Settings

| Web | Mobile target |
|---|---|
| `/settings/profile` | extend `(home)/settings/index.tsx` — basics + creator section + brand section + sticky SaveBar |
| `/settings/notifications` | new — per-kind toggles in 5 groups |
| `/settings/account` | new — identity readout, sign-out, danger-zone delete with typed-name confirm |
| `/settings/billing` | new — protocol-fee history (totals, last 30d, last 20 settled orders) |
| `/settings/appearance` | (mobile already has) — Light/Dark/System toggle |

---

## 11. The buy flow end-to-end (canonical trace)

Brand opens a service → clicks Buy → state machine over multiple
async writes, multiple UI surfaces:

```
[Service detail screen]
  └─ <BuyAction service={service}>
     ├─ derive: contractId = sha256(orderId), escrowPda = pda(...)
     ├─ ConfirmDialog open
     │   "Buy {title}? You'll send {priceSol} SOL.
     │    Seller receives {priceSol - fee}, fee goes to Adler treasury.
     │    Irreversible once confirmed."
     ├─ on confirm:
     │   ├─ fresh balance check (avoid orphan order)
     │   ├─ createOrder({orderId, contractId32, escrowPda, ...})  → Firestore pending
     │   ├─ setPendingOrder(orderId)                              → localStorage
     │   ├─ fundService({orderId, priceSol, brandWallet, creator}) → on-chain
     │   ├─ setPendingOrder(orderId, {signature})                 → localStorage
     │   ├─ createOrderThread(...)                                → Firestore (best-effort)
     │   ├─ retryWithBackoff(markOrderPaid(orderId, sig), 3 × 500ms) → Firestore paid
     │   ├─ clearPendingOrder(orderId)                            → localStorage
     │   └─ toast "Order placed", action: open thread or view tx
     └─ on error: markOrderFailed if no signature, toast

[Cloud Function: notifyOrderStateChanged]
  └─ pending → paid: ping seller via /notifications + Expo push

[Seller's inbox]
  └─ thread row appears with unread bump, thread badge in tabbar
  └─ open thread → markThreadRead(threadId) zeros own unread

[Thread detail (seller view, order paid)]
  └─ <Composer> + "Submit deliverable" CTA
     └─ DeliverableDialog: text + up to 5 attachments
        └─ submitDelivery({contractIdHex, brandWalletAddress, creatorWallet})
        └─ submitDeliverable({threadId, orderId, body, attachments, escrowTxSignature})
           └─ Firestore batch: append `deliverable` message + flip order paid→delivered

[Cloud Function: notifyOrderStateChanged]
  └─ paid → delivered: ping buyer

[Thread detail (buyer view, order delivered)]
  └─ "Approve & complete" + "Request revision" CTAs
     ├─ revision path: requestRevision({threadId, body}) → 1 message; cap = 2
     └─ approve path:
         ├─ approveRelease({contractIdHex, brandWallet, creatorPubkey}) → on-chain
         ├─ approveDeliverable({threadId, orderId, escrowTxSignature})
         │    └─ Firestore batch: append `approval` message + flip order delivered→complete
         ├─ Auto-open RatingDialog (buyer)
         └─ on submit: submitReview({orderId, revieweeId, axes, comment})

[Seller's thread later]
  └─ "Rate buyer" persistent CTA → same RatingDialog flow

[Either side, anytime in `paid` or `delivered` (not after `complete`)]
  └─ "Open dispute" CTA → DisputeDialog → fileDispute({orderId, reason})
     └─ thread shows orange banner, deliveries/approvals/revisions UI-disabled
     └─ arbiter resolves via /admin/disputes/[id] → green banner with outcome
```

---

## 12. Thread detail screen (full state machine)

Most-complex screen in the app. Live state derived from:
- `getThread(threadId)` (refetch on focus, stale 15 s)
- `listMessages(threadId)` (last 100, refetch on focus, stale 15 s)
- `getOrder(orderId)` (only if thread.kind === "order")
- `getReviewByReviewer(orderId, uid)` (am I done rating?)
- `getDisputeByOrder(orderId)` (is there a dispute open/resolved?)

### 12.1 Header

- Counterparty avatar + display name + handle
- Pill: "Application" or "Order"
- For orders: "{amountSol} SOL · {ORDER_STATUS_LABEL[status]}" with InfoTip
  explaining what each status means for the viewer's role

`statusInfo(status, role)` copy (canonical):

| Status | Body | Action (role-specific) |
|---|---|---|
| pending | "Order created. Buyer's wallet hasn't confirmed the on-chain fund_service yet." | buyer: "Confirm the signature prompt in your wallet to fund the escrow." |
| paid | "Escrow is funded on-chain. Seller is up next — submit a deliverable to flip the contract from Bound to Delivered." | seller: "You're up — submit your deliverable so the buyer can approve." |
| delivered | "Seller has submitted. Buyer has ~72 hours to approve before auto_release fires and lamports route to the creator automatically." | buyer: "You're up — approve to release escrow, or request a revision." |
| complete | "Settled. The on-chain escrow PDA is closed: price went to the creator, the 0.5% fee to the treasury, and rent back to the brand." | — |
| failed | "Order aborted before payment landed. No on-chain settlement, no funds moved." | — |

### 12.2 Message log

Rendered as bubbles, one per message; oldest at top, scroll auto-pinned
to bottom on new message. Five message kinds:

| Kind | Renders as | Constraints |
|---|---|---|
| `text` | regular bubble | body ≤ 2000, ≤ 5 attachments |
| `deliverable` | bubble + "Deliverable" badge | seller-sent; sets order delivered |
| `revision_request` | bubble + "Revision request" badge | buyer-sent; counts toward REVISION_CAP=2 |
| `approval` | bubble + "Approval" badge + lime accent | buyer-sent; sets order complete |
| `system` | thin centered note (not a bubble) | written by Cloud Functions — no client write path today |

### 12.3 Action bar (under the log)

Conditional CTAs based on role + status + dispute presence:

```
canSubmitDeliverable  = isOrderThread && isSeller && order.status === "paid"      && !disputeOpen
canApprove            = isOrderThread && isBuyer  && order.status === "delivered" && !disputeOpen
canRequestRevision    = isOrderThread && isBuyer  && order.status === "delivered" && !disputeOpen
canFileDispute        = isOrderThread && order &&
                        ((isBuyer  && order.status in [paid, delivered]) ||
                         (isSeller && order.status === "delivered"))
canRate               = isOrderThread && order.status === "complete" && !existingReview
revisionsExhausted    = revisionsUsed >= REVISION_CAP    // 2
```

When `revisionsExhausted` is true, the "Request revision" button label
flips to "Open dispute" with an `AlertTriangle` icon.

### 12.4 Banners

- **Open dispute** (orange): "Dispute open · awaiting Adler review.
  Filed by {buyer/seller}. Deliveries, approvals, and revisions are
  paused while arbitration is in progress."
- **Resolved dispute** (lime): "Dispute resolved — {outcome label}{,
  {pct}% to creator}". Includes outcome note. If
  `PENDING_SETTLEMENT[outcome]`, append "Settlement pending the on-chain
  escrow program."

### 12.5 Read receipts

`useEffect` on mount: if `thread.unreadCount[uid] > 0`, call
`markThreadRead(threadId)` and invalidate the thread + threads-list
queries. Counterparty unread is bumped server-side by
`onMessageCreate`.

---

## 13. Settings screens (port spec)

### 13.1 `/settings/profile`

Three sections, in order:
1. **Basics** — display name (1–50), bio (≤ 280, multi-line),
   avatar (square crop 1:1, JPEG only, ≤ 2 MB), country (ISO-3166-1
   alpha-2 combobox or null = "Global").
2. **Creator section** — niches (1–6, 24-char cap each, lowercased,
   suggested chips from `SUGGESTED_NICHES`), portfolio URL, social
   links list (Instagram/YouTube/TikTok/X — paste URL or handle, web
   uses `detectAndNormalizeSocialLink`), DM contact (email, telegram,
   phone — each independently nullable; collapses to null if all blank).
   **Empty state:** "Set up Creator side" affordance to seed the section.
3. **Brand section** — companyName (required, 1–60), industry
   (combobox over `INDUSTRY_GROUPS` — 15 grouped options with accent
   tagging, see `lib/utils/industries.ts`), websiteUrl (lenient
   normalize via `lib/utils/url.ts`), DM contact.

Both sub-sections offer a "Clear" button that sets the entire side to
null (rule: writers flip `isCreator`/`isBrand` to false in lockstep).

`username` is **read-only** in v1 — renaming requires a slug
migration that's out of scope.

Sticky save bar at the bottom; on web `DirtyFormsContext` blocks
sidebar navigation while dirty. Skip the dirty-forms machinery on
mobile if simpler.

### 13.2 `/settings/notifications`

Five groups (`NOTIFICATION_KIND_GROUPS`):
- **Orders** — `order_state` (state changes)
- **Messages** — `thread_message`
- **Applications** — `application_received`, `application_decided`
- **Disputes** — `dispute_filed`, `dispute_resolved`
- **System** — `system`

One toggle per kind, optimistic update via dotted-path setDoc on
`preferences/{uid}`. Default (no doc) = everything on; the read path
falls back to `DEFAULT_PREFERENCES`.

> **Mobile push prefs:** the v1 prefs gate **in-app + email** but not
> mobile push. Push fan-out is unconditional (the Cloud Function
> reads `pushTokenFor(uid)` and sends regardless). When mobile push
> prefs land, gate on the same kind keys.

### 13.3 `/settings/account`

- Identity readout: username, email (from `auth.currentUser.email` or
  Privy linked accounts), wallet address.
- Sign-out section: button → `useAuth().signOut()`.
- **Danger zone** — delete account. `DeleteAccountDialog` requires the
  user to type their `@username` exactly to enable the confirm button.
  On confirm: `deleteAccount()` Cloud Function call, then sign out and
  route to `/sign-in`.

### 13.4 `/settings/billing`

Protocol-fee history page. Pulls `listOrdersAsBuyer(uid)` +
`listOrdersAsSeller(uid)`, runs `feeHistoryStats` to produce:

- Total fees paid (SOL + count of settled orders)
- Last 30 days fees
- Total contract volume across both roles
- Last 20 settled orders with per-order fee, role, link to order thread

Copy explicitly anchors the whitepaper §6/§8 — 0.5% per settled
contract, no subscriptions, no listing fees.

---

## 14. Theme & design tokens

The web has Light / Dark / System theme **only inside the home
layout** (`app/(app)/(home)/*`). Marketing landing and auth screens
always render light. On mobile, the existing `appearance.tsx` settings
screen handles this; respect it across the app.

### 14.1 Color rule (non-negotiable on web)

> Use Tailwind's stock `neutral-*` palette + the brand accents listed
> below. **No `bg-white`, `text-white`, `bg-black`, `text-black`
> anywhere** — they don't flip with theme. Use `neutral-50` / `neutral-950`.

Adapt to your RN style system — but the **invariant** is: the only
colors in the app are neutrals (which flip with theme) plus a fixed
set of accents (which don't). Don't introduce new colors.

### 14.2 Brand accents (fixed across themes)

| Token | Hex | Usage |
|---|---|---|
| `accent-pink` | `#ff0088` | Primary brand accent — headlines, active nav, CTAs |
| `accent-cyan` | `#00d4ff` | "Paid" status, shortlisted apps |
| `accent-lime` | `#4cd900` | "Complete" / "Awarded" status, lime banners |
| `accent-orange` | `#ff5900` | "Delivered" status, open-dispute banner |
| `status-error` | `#dc143c` | Error states, danger-zone, sign-out |
| `action-send` | `#ef4444` | Wallet send action |
| `action-receive` | `#22c55e` | Wallet receive action |
| `scrim` | `#000000` | Modal backdrop (does NOT flip — needs to stay dark) |

Status pill class maps live in the type files:
- `APPLICATION_STATUS_CLASS` (lib/types/application.ts)
- `ORDER_STATUS_CLASS` (lib/types/order.ts)
- `DISPUTE_STATUS_CLASS` (lib/types/dispute.ts)

### 14.3 Spacing + radius tokens

```
--spacing-screen: 16px
--spacing-section: 24px
--spacing-item: 8px
--radius-input: 8px
--radius-button: 12px
--radius-card: 12px
--radius-sheet: 24px
--tracking-adler: -0.03em
--duration-fast: 150ms
--duration-normal: 200ms
--duration-slow: 300ms
--duration-sheet: 400ms
```

### 14.4 Gradient

Adler's signature gradient:

```css
--grad-1: #e8753b;
--grad-2: #ee6065;
--grad-3: #f44b8f;
--grad-4: #fa38b5;
--grad-5: #ff24db;
linear-gradient(90deg,
  var(--grad-1) 0%,    var(--grad-2) 23.8%,
  var(--grad-3) 47.6%, var(--grad-4) 73.8%,
  var(--grad-5) 100%);
```

Allowed on: submit buttons, step-number badges, stat numerals, icon
chips, decorative hero orb. **Forbidden on body copy, links, form
labels/placeholders, footer text.** Headline gradient text only on
≤ 6-word headlines, ≥ 24 px, ≥ 600 weight.

### 14.5 Other rules (from CLAUDE.md)

- **Never use all-uppercase text** — strip `uppercase` styling, drop
  paired wide tracking. Capital words only when grammatically required.
- **Don't use the `Sparkles` icon** (reads as AI-slop). Same caution
  for `Wand2`, `Stars`, decorative `Zap`.

### 14.6 Typography

Web uses bespoke utility classes (`.text-h1` through `.text-h6`,
`.text-base-regular`/`semibold`, `.text-sm-regular`/`semibold`, etc.).
Headings scale up on `sm:` (640 px) and `lg:` (1024 px); body sizes are
fixed. Mobile viewport is small — keep body sizes fixed and headings
tight (`h2-h3` is plenty; `h1` is overkill for phone screens).

`text-balance` on short headings, `text-pretty` on multi-line paragraphs.

---

## 15. Cloud Functions reference

All in `../adler-app/functions/index.js`. Don't redeploy from
mobile-side; flag bugs.

| Function | Trigger | Purpose |
|---|---|---|
| `mintFirebaseToken` | callable | Privy access token → Firebase custom token |
| `deleteUserAccount` | callable | Account deletion (archives listings, deletes profile + slug, revokes Privy + Firebase) |
| `solanaRpcProxyDevnet` | onRequest | Forward Solana JSON-RPC to Helius (devnet) — keeps RPC key out of client |
| `solanaRpcProxyMainnet` | onRequest | Same for mainnet |
| `reconcilePendingOrders` | scheduled (every 30 min) | Flip stale `pending` orders (>1 h old) to `failed` |
| `cascadeApplicationsOnGigClose` | onUpdate `gigs/{id}` | Auto-reject pending applications when gig moves out of `open` |
| `notifyApplicationReceived` | onCreate `gigApplications/{id}` | Ping brand: in-app + Expo push |
| `notifyApplicationDecided` | onUpdate `gigApplications/{id}` | Ping creator on shortlisted/awarded/rejected |
| `notifyOrderStateChanged` | onUpdate `orders/{id}` | Ping counterparty on status flips |
| `onMessageCreate` | onCreate `threads/{id}/messages/{id}` | Fan out lastMessage* + counterparty unread bump + thread_message notifications |
| `notifyDisputeFiled` | onCreate `disputes/{id}` | Ping counterparty + every arbiter |
| `notifyDisputeResolved` | onUpdate `disputes/{id}` | Ping both parties with outcome |
| `onNotificationCreateEmail` | onCreate `notifications/{id}` | Resolve recipient email via Privy admin → write `mail/{auto}` for the firestore-send-email extension |

**Push fan-out:** every notify-* trigger reads
`profiles/{uid}.pushToken` and posts to Expo's hosted push service
(`https://exp.host/--/api/v2/push/send`). The mobile app **must**
maintain that field (ask for permission, get the Expo push token, write
on first run, refresh on token rotation).

**Email fan-out:** writes `/mail/{auto}` for the
`firebase/firestore-send-email` Firebase extension. Per-kind subject +
CTA templates. Gated on `preferences/{uid}.notifications[kind]`. The
extension delivers via the configured SMTP.

**bumpActivity:** every notify-* trigger also writes
`profiles/{uid}.latestActivityAt = serverTimestamp()` (admin SDK
bypasses the rule, which doesn't allow client writes to that field).
Drives the "recently active" sort on directory pages.

---

## 16. Common gotchas

1. **Firestore rule field-name remapping.** Listings store
   `sellerHandle`/`brandHandle` but the TS type exposes `ownerHandle`.
   The `readService` / `readGig` functions do the mapping. Mirror it.
2. **`isCreator`/`isBrand` MUST mirror sub-profile presence.** Rule
   checks this (`validProfileRoleFlag`). Always update both atomically.
3. **`walletAddress` is append-only.** Never overwrite; validate before
   write. The rule will reject otherwise.
4. **Order denormalized fields are immutable post-create.** The
   order-update rule restricts `affectedKeys` to
   `['status','txSignature','updatedAt']`. Don't try to backfill
   `listingTitle` etc. later.
5. **`txSignature` is append-only on orders too.** Once set, identical
   value or rule rejects.
6. **Deterministic doc ids defeat double-tap races.** Applications,
   threads, reviews, disputes all use deterministic ids — embrace this
   instead of generating new uuids.
7. **Server-only writers.** Notifications: clients can only flip `read:
   true`. `mail/`: clients are denied entirely.
8. **`null` vs missing key for `dmContact`.** Persist the whole object
   as null when every channel is empty. Mid-state objects with all-null
   channels are not allowed (directory queries assume null = closed).
9. **Country must be uppercase** ISO-3166-1 alpha-2. Web uppercase
   before write. Same on mobile.
10. **Firestore rules can't `!=` map fields.** That's why
    `isCreator`/`isBrand` denorms exist; directory queries equality-filter.
11. **Composite indexes are deployed.** If you add a new query that
    isn't covered, Firestore will throw a clear error pointing at a
    missing index. Add it to `../adler-app/firestore.indexes.json` and
    deploy.
12. **`cached_profile` can be stale.** It's a SWR seed for instant
    paint; the live query overwrites. Always render from the query
    data, not the cache.
13. **Thread `unreadCount` map can have orphan entries.** Old participant
    ids hang around if a profile is deleted. Read defensively
    (`unreadCount[uid] ?? 0`).
14. **Privy embedded wallet appears asynchronously.** First sign-in
    flow may bridge to Firebase before the wallet is provisioned;
    `walletAddress` lands on the next `useWallets()` tick. Render the
    wallet UI defensively for `wallets?.[0]?.address ?? null`.
15. **`signAndSendTransaction` on Wallet Standard** returns
    `{ signature: Uint8Array }`. Encode with `bs58.encode(...)` for
    explorer URLs and Firestore.
16. **Anchor error parsing.** `EscrowError.code` is the parsed
    Anchor error code (`FeeTreasuryMismatch`, `WrongState`, etc.). UI
    mappings should switch on `.code`, not `.message`.
17. **`approve_release` is idempotent.** If the escrow PDA is already
    closed (retry after a partial settlement), `approveRelease`
    returns `signature: null` and the caller should still proceed to
    the Firestore mirror write.
18. **Submit/approve tx sigs go on the message doc**, not the order
    doc, because the order-update rule blocks adding fields after
    create. The `escrowTxSignature` + `escrowTxConfirmedAt` fields on
    `Message` are exactly for this.

---

## 17. Mobile-specific recommendations

1. **Privy SDK:** use `@privy-io/expo` (or whatever the current native
   SDK is named); pass both `appId` AND `clientId` (the native client
   id). Web omits `clientId`; native requires it.
2. **Embedded wallet on iOS:** Privy creates the wallet in a secure
   enclave / keychain. No additional setup needed beyond the provider
   config above.
3. **Firebase RN:** use the modular SDK (same imports as web work in
   RN). Persistence: pass
   `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`
   instead of `getAuth(app)` so the user stays signed in across launches.
4. **AsyncStorage** for the localStorage map (`onboarding_seen`,
   `view_mode`, `cached_profile`, `adler.solUsd`, `adler.pendingOrders`).
   Same keys as web for parity.
5. **Push token:** on first run after sign-in, request notification
   permission, get the Expo push token via
   `Notifications.getExpoPushTokenAsync()`, write to
   `profiles/{uid}.pushToken`. Refresh on token rotation
   (`Notifications.addPushTokenListener`).
6. **Online detection:** swap `navigator.onLine` for
   `@react-native-community/netinfo`'s `useNetInfo().isConnected`.
7. **Solana web3.js in RN:** add
   `react-native-get-random-values` as the first import in your entry
   file (web3.js's `Keypair.generate()` needs it). Anchor + bs58 work
   fine in RN with Metro >0.70.
8. **Storage uploads:** use `expo-file-system` to read the file as a
   blob, then `uploadBytes(ref, blob, { contentType })`. For video,
   pre-validate size client-side (`Storage rule caps at 50 MB`).
9. **Image cropping:** web uses `react-easy-crop` for the avatar
   square crop. RN: `expo-image-picker`'s `allowsEditing: true,
   aspect: [1,1]` plus `expo-image-manipulator` to re-encode JPEG.
10. **QR code (receive):** use `react-native-qrcode-svg` or similar
    instead of `qrcode.react`.
11. **Solana Explorer linking:** `txExplorerUrl(sig)` and
    `addressExplorerUrl(addr)` in `lib/solana/explorer.ts`.
    Cluster-aware.
12. **Devnet airdrop button:** only enable when
    `IS_DEVNET_LIKE`. Surface the signature even if confirmation times
    out — devnet airdrop confirmation flakes regularly.
13. **Toasts:** web uses Sonner. Mobile: use a native toast/snackbar
    primitive. Same content (and especially the "View tx" / "Open
    thread" actions on success toasts).
14. **Deep links:** the Cloud Functions write `href` paths like
    `/inbox/order_xyz`, `/applicants`, `/admin/disputes/abc`. Map these
    onto your Expo Router routes (`/inbox/[threadId]`, etc.) and
    register URL schemes for push tap-through.
15. **iOS App Store account-deletion requirement (5.1.1(v)):** the
    `deleteUserAccount` Cloud Function exists exactly for this; wire
    `/settings/account` to it. The dialog needs typed-name confirmation.
16. **Background tasks:** the `RecoverPendingOrders` boot job runs
    on every app start. Fine for mobile; no need for a background
    task.
17. **Tabbar role-awareness:** the existing 4-tab shell
    (`browse`/`inbox`/`profile`/`saved`) is fine. The current web has
    different sidebar nav for creator vs brand modes. On mobile, you
    can either:
    - Keep one tabbar and surface role-locked screens behind
      `<ProfileGate>` (simpler), or
    - Show different secondary nav within `browse` (header pills) when
      the user toggles mode.
   Don't try to dynamically rebuild the tabbar — the navigation state
   has to be stable.

---

## 18. Suggested build order

1. **Auth bridge.** Privy + Firebase + `mintFirebaseToken` + profile
   bootstrap. Validate by signing in, seeing `profiles/{uid}` appear,
   `walletAddress` populating.
2. **Firebase init + service layer skeleton.** Port all `lib/types/*.ts`
   verbatim (TS only; no platform deps). Port `lib/services/*.ts`
   one collection at a time, smoke-tested with the rules emulator
   (`firebase emulators:start --only firestore`).
3. **Browse + listing detail (read-only).** Validates query keys,
   composite indexes, denormalized fields render correctly.
4. **Profile setup.** Creator + brand sub-sections; avatar pipeline.
   Validates Storage, dirty-form/save UX, role flag denorms.
5. **Listings authoring.** Creator services + brand gigs CRUD,
   archive/resume, listing media upload.
6. **Applications.** Apply flow + brand triage + status tabs.
7. **Threads & messaging.** Inbox tab, thread detail, composer,
   self-zero unread, attachments. The deepest screen — leave time.
8. **Wallet.** Send, receive, balance, recent activity, devnet
   airdrop. Validates Solana plumbing without touching escrow.
9. **Buy flow with escrow.** `BuyAction` end-to-end: derive
   contract id, `fundService`, `markOrderPaid`, breadcrumb +
   recovery. This is the riskiest port — single-step it.
10. **Submit deliverable + approve.** Round-trip the full order
    state machine.
11. **Reputation.** Rating dialog auto-prompt on approve, public
    profile aggregate.
12. **Disputes.** File + arbitration panel (or skip arbiter UI on
    mobile if not in scope).
13. **Notifications.** In-app feed + push token registration +
    deep-link handling.
14. **Settings finishing.** Notifications prefs, account, billing.
15. **Spend dashboard, sales/purchases history, applicants inbox,
    my applications.** Aggregate views — relatively cheap once
    the underlying queries are wired.

Each step has a clear acceptance signal: a Firestore doc shape, a
specific UI state, a tx signature. Don't move on until the step works
end-to-end against the production project (`emptea-adler`) — the
emulator is for rule lints, not for trust.

---

## 19. Files to read alongside this doc

In rough order of impact:

1. `adler-website/PRODUCT.md` — the product sheet. Concise, canonical.
2. `adler-website/TODO.md` — what's shipped, what's in-flight (esp. the
   "Web integration with the on-chain escrow program" section).
3. `../adler-app/firestore.rules` — every constraint, every state
   machine, every cap.
4. `adler-website/lib/types/*.ts` — every doc shape.
5. `adler-website/lib/services/*.ts` — every read/write you'll port.
6. `adler-website/contexts/AuthContext.tsx` — the bridge orchestration.
7. `adler-website/components/app/listings/BuyAction.tsx` — the buy
   flow end-to-end (densest single file in the app).
8. `adler-website/app/(app)/(home)/inbox/[threadId]/page.tsx` — the
   thread state machine.
9. `../adler-app/functions/index.js` — what the server does for free
   so the client doesn't have to.

When in doubt, read the rule file. It's the contract; everything else
is a client of it.

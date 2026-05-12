# Adler

> **Mobile target: iOS only.** The Expo project ships to iOS and web; Android is intentionally out of scope. Package managers: **pnpm** at the repo root (`pnpm install`); the `functions/` subdirectory uses **npm** (a pnpm install there breaks the `uuid` override at deploy time).

A bounty marketplace built on Solana. Anyone can post a funded bounty, anyone can submit, and the on-chain escrow releases funds to the winner the poster picks.

---

## What's in the app

### Bounties
- Anyone with an embedded Solana wallet can post a funded bounty. Funds are locked in an escrow PDA on **Solana devnet** by the `adler-escrow` Anchor program at creation time (`escrowFunded: true`).
- **Submission window:** 30 days from creation (`SUBMISSION_WINDOW_SECS`).
- **Review window:** 90 days after the submission window closes (`REVIEW_WINDOW_SECS`). After review opens, the bounty status flips to `in_review` and the poster picks a winner.
- **Submission kinds:** `photo`, `video`, or `link` (chosen by the poster at create time).
- **Scope:** `public` (visible on the global Browse feed) or `group` (visible only to members of a curated group — see Groups below).
- **Lifecycle states:** `open` → `in_review` → `settled` / `refunded`, with side states `cancelling` (in-flight cancel) and `hidden` (moderation).

### Submissions
- Hard cap: **one submission per user per bounty** (`MAX_SUBMISSIONS_PER_USER`), enforced both client-side and by the `enforceSubmissionCap` Cloud Function trigger.
- Media uploads go through Firebase Storage with image compression (`bountyMediaUploadService`, `imageUploadService`).
- Submissions can be reported by other users. The `enforceReportThreshold` trigger auto-hides submissions that cross a moderation threshold.

### Escrow paths (all on-chain)
1. **Create** — `create_bounty` instruction; lamports move from poster to escrow PDA.
2. **Settle (manual, only mode)** — `settle_manual_bounty`: poster picks a winner after `submissionEndsAt`. Winner receives `amount − 0.5%`, the **0.5% protocol fee** (`PROTOCOL_FEE_BPS = 50`) goes to `feeTreasury`. Status → `settled`.
3. **Cancel** — `cancel_bounty`: poster only, only while the bounty has zero submissions. Status flips to `cancelling`, runs the instruction, finalizes to `refunded`. On failure `abortCancel` reverts; otherwise the `expireBounties` scheduled Function sweeps stuck `cancelling` docs.
4. **Refund (expired)** — `refund_bounty`: anyone can call after `expiresAt = submissionEndsAt + 90d` when no winner was picked. Funds return to poster, status → `refunded`.

There is **no auto-settlement and no AI verifier** path. Manual-only settlement is intentional (dropped in commit `a1dae7d`).

### Groups
- Curated audiences for scoped bounties (creator program, brand-specific cohort, etc.).
- `groups/`, `groupMembers/` (compound id `<groupId>_<userId>`), `joinRequests/`, `groupCreationRequests/` Firestore collections.
- Group creation is gated: users submit a `groupCreationRequest`, a super-admin approves via `createGroup` / `activateGroup` Cloud Functions.
- Membership mutations (`addGroupMember`, `removeGroupMember`, `updateGroup`) are server-side Functions — never written directly from the client.
- Posting a `scope: 'group'` bounty restricts visibility to members.

### Leaderboard
- Global rankings across three metrics: **SOL won** (`lamportsWonFromBounties`), **Wins** (`bountiesWon`), **Submissions** (`bountiesParticipated`).
- Counters live on `profiles/{uid}` and are updated server-side as bounties settle.

### Wallet
- Embedded Solana wallet provisioned by Privy on first sign-in.
- **Send** SOL to any address (`SendSheet`), **Receive** via QR (`ReceiveSheet`), **Activity** view of recent on-chain transactions (`wallet/activity.tsx`).
- Balance polls every 30 s while the wallet tab is active.
- Devnet today; mainnet flip is post-MVP.

### Inbox & notifications
- In-app inbox feed (`notifications/` collection) driven by Cloud Function triggers:
  - `notifyBountySubmissionReceived` — when someone submits to your bounty.
  - `notifyBountySettled` — when a bounty you participated in settles.
- Expo push notifications for the same events; tokens stored on `profiles/{uid}.pushToken`, foreground handler in `pushService`.

### Profiles
- Unique username (transactional reservation against `usernames/{slug}`), display name, bio, avatar, location, optional DM contact, wallet address.
- Bootstrapped on first sign-in via `ensureProfileExists`; users can rename later (rate-limited via `lastUsernameChangeAt`).
- **Account deletion** runs through the `deleteUserAccount` Cloud Function, which atomically wipes the user's docs and revokes auth.

### Moderation
- Per-submission `reports/` collection. The `enforceReportThreshold` Function auto-hides submissions that cross the threshold.
- Super-admin role (`SUPER_ADMIN_UID` secret) bootstrapped via `bootstrapSuperAdmin`, then extended via `grantSuperAdmin`.

---

## Stack

- **App framework:** Expo 55, React Native 0.83, TypeScript (strict), expo-router (file-based)
- **Styling:** NativeWind 4 + Tailwind tokens, theme-aware light/dark palette (invertible monochrome + accent + status palettes)
- **Animation / graphics:** `react-native-reanimated` 4, `@shopify/react-native-skia` (TabBar, ProgressBar, ArrowProgress, custom loaders)
- **Icons & fonts:** `lucide-react-native`; Geist Regular + SemiBold via `expo-google-fonts`
- **Auth:** `@privy-io/expo` email OTP → embedded Solana wallet → Firebase custom token bridge
- **Payments:** `@solana/web3.js` + `@coral-xyz/anchor` against devnet — `adler-escrow` Anchor program (IDL synced from the `adler-program` repo into `lib/anchor/idl.ts` and `functions/idl.json`)
- **Server state:** TanStack Query 5 with a centralized key factory (`lib/constants/queryKeys.ts`)
- **Global state:** React Context — `AuthContext` (Privy ↔ Firebase, NetInfo debounce), `UserContext` (cached profile), `ThemeContext`, `OverlaySheetsContext`
- **Backend:** Firebase 12 — Firestore + Storage + Cloud Functions + **App Check** (DeviceCheck on iOS, reCAPTCHA Enterprise on web)
- **Haptics:** `expo-haptics` (vocabulary in `lib/utils/haptic.ts`)

---

## Cloud Functions

All in `functions/index.js`. Deploy with `firebase deploy --only functions`.

| Function | Type | Purpose |
|----------|------|---------|
| `mintFirebaseToken` | callable | Verifies Privy JWT, mints Firebase custom token (`uid = privy.userId`) |
| `solanaRpcProxyDevnet` | HTTP | Devnet RPC proxy so the Helius API key stays server-side in production builds |
| `enforceSubmissionCap` | Firestore trigger (onCreate `submissions/`) | Rejects > 1 submission per user per bounty, increments `submissionCount` |
| `decrementSubmissionCountOnDelete` | Firestore trigger (onDelete `submissions/`) | Keeps `bounties/{id}.submissionCount` accurate |
| `enforceReportThreshold` | Firestore trigger (onCreate `reports/`) | Auto-hides submissions that cross the moderation threshold |
| `expireBounties` | scheduled | Sweeps `cancelling` docs that never finalized + flips `open` → `in_review` at `submissionEndsAt` |
| `notifyBountySubmissionReceived` | Firestore trigger | Inbox + push fan-out to the poster |
| `notifyBountySettled` | Firestore trigger | Inbox + push fan-out to participants on settle |
| `deleteUserAccount` | callable | Atomic user data wipe + auth revoke |
| `bootstrapSuperAdmin` / `grantSuperAdmin` | callable | Admin role setup |
| `createGroup` / `activateGroup` / `updateGroup` | callable | Group lifecycle (request → active) |
| `addGroupMember` / `removeGroupMember` | callable | Group membership mutations |

---

## Firestore collections

| Collection | Purpose |
|-----------|---------|
| `profiles/{uid}` | Profile + leaderboard counters; `uid == Privy user id == Firebase auth uid` |
| `usernames/{slug}` | Unique-username sentinel (transactional reservation) |
| `bounties/{id}` | Poster-funded bounties (`status`, `submissionKind`, `scope`, `groupId`, `submissionEndsAt`, `expiresAt`, `bountyLamports`, `contractIdHex`, `escrowFunded`, `submissionCount`, `reportCount`) |
| `submissions/{id}` | One per (user, bounty); media URLs + status |
| `reports/{id}` | Moderator reports against submissions |
| `groups/{id}` | Curated audience groups |
| `groupMembers/{compoundId}` | `<groupId>_<userId>` membership join-table |
| `joinRequests/{id}` | Pending group join requests |
| `groupCreationRequests/{id}` | Pending requests to create new groups |
| `notifications/{id}` | In-app inbox feed |
| `preferences/{uid}` | Per-user preferences (notification toggles, etc.) |

---

## Required environment variables

Add to `.env` at the repo root:

```
EXPO_PUBLIC_PRIVY_APP_ID=
EXPO_PUBLIC_PRIVY_CLIENT_ID=
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_SOLANA_NETWORK=devnet
EXPO_PUBLIC_SOLANA_RPC_URL=
EXPO_PUBLIC_SOLANA_RPC_PROXY_URL=
EXPO_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY=
```

`EXPO_PUBLIC_SOLANA_RPC_URL` is required in dev — point at a Helius devnet endpoint (public RPCs are rate-limited and unsupported). In production builds, set `EXPO_PUBLIC_SOLANA_RPC_PROXY_URL` to the deployed `solanaRpcProxyDevnet` Cloud Function URL instead, so the Helius key stays server-side. `EXPO_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` is web-only (App Check via reCAPTCHA); skip it for iOS dev (iOS uses DeviceCheck).

Cloud Function secrets (set via `firebase functions:secrets:set`):

```
PRIVY_APP_ID
PRIVY_APP_SECRET
HELIUS_RPC_URL_DEVNET
VERIFIER_KEYPAIR_BASE58
SUPER_ADMIN_UID
```

---

## First run

```sh
pnpm install                     # root + mobile app
( cd functions && npm install )  # functions uses npm, not pnpm
pnpm prebuild                    # regenerate iOS native dir
pnpm ios                         # build & run on iOS
```

## Deploy backend

```sh
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

## Devnet wallet funding

```sh
solana airdrop 1 <wallet-address> --url devnet
```

---

## Repo layout (high-level)

```
app/                    Expo Router file-based routes
  (auth)/sign-in.tsx    Privy email-OTP login
  (home)/
    (tabs)/             Browse · Inbox · Wallet · Profile
    bounty/[id].tsx     Bounty detail (submissions + settle/refund/cancel)
    bounty/[id]/        Submit composer
    group/[id].tsx      Group detail
    leaderboard.tsx     Global rankings
    notifications.tsx
    wallet/activity.tsx
    settings/           account · profile · notifications · about

components/
  base/                 ThemedText, ThemedView, ScreenHeader, ErrorBoundary
  ui/                   Button, Card, BottomSheet, TabBar, Pill, ProgressBar, …
  features/             account · bounty · groups · home · notifications · wallet

lib/
  firebase/             Firebase singletons (Auth + Firestore + Storage + Functions + App Check)
  solana/               Connection, lamport↔SOL helpers, transferSol
  anchor/               IDL + types + Program<AdlerEscrow> binding
  escrow/               createBounty · settleManualBounty · refundBounty · cancelBounty
  services/             bounty · submission · group · profile · report · notifications · push · leaderboard · …
  constants/            queryKeys · escrow · featureGates · storageKeys
  types/                bounty · submission · group · profile · notification · preferences
  utils/                cn · dates · haptic · toast · formatNumber · copy

constants/              ThemePalettes · LayoutConstants · TailwindColors · StatusColors · NeutralColors
contexts/               AuthContext · UserContext · ThemeContext · OverlaySheetsContext · QueryProvider
hooks/                  useBounty · useBountyEscrow · useLeaderboard · useDebounce
functions/              Firebase Cloud Functions (npm, not pnpm)
```

The Anchor program itself lives in a separate `adler-program` repo; its IDL is synced into `lib/anchor/idl.ts` and `functions/idl.json` via that repo's `scripts/sync-idl.sh`.

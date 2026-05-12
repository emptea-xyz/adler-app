# Adler — App Architecture

## Tech Stack

- **Framework**: Expo 55 + React Native 0.83 + Expo Router (file-based routing). iOS-only target — `app.json` platforms = `["ios", "web"]`.
- **Language**: TypeScript (strict mode, `@` path alias = project root)
- **Styling**: NativeWind 4 (Tailwind CSS for RN), class builder via `cn()` in `lib/utils/cn.ts`
- **State**: TanStack Query 5 (server state) + React Context (global state) + useState (local)
- **Auth**: Privy (`@privy-io/expo`) with embedded Solana wallets, bridged to Firebase Auth via a Cloud Function
- **Payments**: Anchor program `adler-escrow` on Solana devnet — funded bounty escrows, manual settlement (poster picks winner), refund + cancel paths
- **Backend**: Firebase 12 (Firestore + Storage + Functions + App Check). No analytics/crash reporting on the client in v1.
- **Animations**: `react-native-reanimated` 4 + `@shopify/react-native-skia` (TabBar, ProgressBar, EagleLoader, ArrowProgress)
- **Icons**: `lucide-react-native` (via `components/ui/Icon.tsx`)
- **Fonts**: Geist (400 Regular, 600 SemiBold) via `expo-google-fonts`
- **Haptics**: `expo-haptics` (vocabulary in `lib/utils/haptic.ts`)

## Polyfills (load order matters)

`index.js` (the app entry) loads polyfills *before* `expo-router/entry`. Order is significant:

```js
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import 'fast-text-encoding';
import '@ethersproject/shims';

import 'expo-router/entry';
```

Do NOT add `react-native-quick-crypto` — `@solana/web3.js@1.x` doesn't need it for SOL transfers, and Privy handles signing in its own native layer.

## Auth bridge

Privy issues a JWT for the authenticated user; we mint a Firebase custom token from it so Firestore rules using `request.auth.uid == <userId>` continue to work.

1. Client signs in with Privy (email OTP today).
2. `usePrivy().getAccessToken()` returns the Privy JWT.
3. Client calls Cloud Function `mintFirebaseToken({ accessToken })`.
4. Function verifies the token via `@privy-io/server-auth`, mints a Firebase custom token with `uid = privy.userId`.
5. Client calls `signInWithCustomToken(auth, customToken)`.

`AuthContext` orchestrates this. The Firebase user is the canonical `user` exposed downstream — `userId` is always the Privy user id.

## Directory Structure

```
app/                              # Expo Router file-based routing
├── (auth)/                       # Pre-auth
│   ├── _layout.tsx
│   └── sign-in.tsx               # Privy email-OTP login
├── (home)/                       # Authenticated app
│   ├── _layout.tsx               # Routes guard: needs user
│   ├── (tabs)/                   # Browse / Inbox / Wallet / Profile
│   │   ├── _layout.tsx
│   │   ├── browse.tsx
│   │   ├── inbox.tsx
│   │   ├── wallet.tsx
│   │   └── profile.tsx
│   ├── bounty/[id].tsx           # Bounty detail (submissions + settle / refund / cancel)
│   ├── bounty/[id]/submit.tsx    # Submission composer
│   ├── notifications.tsx
│   ├── wallet/activity.tsx       # Recent on-chain activity
│   └── settings/                 # account, profile, notifications, about, index
├── _layout.tsx                   # Root: ErrorBoundary → GestureHandlerRootView → PrivyProvider → QueryProvider → ThemeProvider → AuthProvider → UserProvider
├── +not-found.tsx
└── index.tsx                     # Two-state routing: no-user → sign-in; user → browse

components/
├── base/                         # ThemedText, ThemedView, ScreenHeader, ErrorBoundary, OfflineBanner, SectionLabel, LoadingScreen, InitialLoadingScreen
├── ui/                           # Generic primitives — Button, Card, BottomSheet, Skeleton, NumberInput, TextInput, Avatar, Dropdown, Alert, EmptyState, ErrorState, PopoverMenu, Pill, ProgressBar, SegmentedToggle, ToastConfig, TabBar, ActionTile, CircleIconButton, AdlerEagleLogo, EagleLoader, Icon, SolanaIcon
│   └── icons/                    # ArrowProgress
└── features/
    ├── account/                  # DeleteAccountSheet, SignOutSheet
    ├── bounty/                   # BountyItemCard, BountyStatusIcon, BountyTags, PostBountySheet
    ├── groups/                   # GroupsSearchSheet
    ├── home/                     # AdlerHomeHeader (greeting + wallet pill on Browse)
    ├── notifications/            # PushPermissionPrompt
    └── wallet/                   # ConnectivitySheet, ReceiveSheet, SendSheet

contexts/
├── AuthContext.tsx               # Privy ↔ Firebase orchestration, walletAddress, runIfOnline, NetInfo debounce
├── UserContext.tsx               # Profile loader, SWR cache via AsyncStorage, profile bootstrap on first sign-in
├── ThemeContext.tsx              # Theme palette + light/dark mode
├── OverlaySheetsContext.tsx      # Imperative open/close for shared bottom sheets
└── QueryProvider.tsx             # TanStack Query client

hooks/
├── useBounty.ts                  # Single-bounty query
├── useBountyEscrow.ts            # post / settleManual / refund / cancel — wraps Firestore service + on-chain escrow call
└── useDebounce.ts

lib/
├── firebase/config.ts            # Firebase Auth + Firestore + Storage + Functions + App Check singleton
├── solana/
│   ├── connection.ts             # `Connection` + lamport↔SOL helpers + explorer URL builders
│   └── transferSol.ts            # Build, sign, send a SystemProgram.transfer via Privy wallet provider (used by Send sheet)
├── anchor/
│   ├── idl.ts                    # Auto-generated IDL (sync via adler-program/scripts/sync-idl.sh)
│   ├── idl-types.ts              # Matching TS types
│   ├── program.ts                # `getProgram()` — anchor Program<AdlerEscrow> bound to current connection
│   └── useFeeTreasury.ts         # Fetch protocol_config.fee_treasury (cached)
├── escrow/
│   ├── _send.ts                  # Sign + send raw instruction batch via Privy embedded wallet provider
│   ├── pda.ts                    # deriveBountyEscrowPda, deriveProtocolConfigPda, contractIdFromHex
│   ├── createBounty.ts           # `create_bounty` instruction
│   ├── settleManualBounty.ts     # `settle_manual_bounty` instruction
│   ├── refundBounty.ts           # `refund_bounty` (post-expiry, anyone can call)
│   └── cancelBounty.ts           # `cancel_bounty` (poster only, before submissions)
├── services/
│   ├── privyAuthService.ts       # Privy JWT → Firebase custom token + signInWithCustomToken
│   ├── profileService.ts         # ensureProfileExists (transactional), updates, walletAddress, pushToken
│   ├── bountyService.ts          # CRUD + listPublic / listByPoster / listByGroup + draftBounty / persistBounty / markManualSettled / start|finish|abortCancel
│   ├── bountyMediaUploadService.ts # Bounty cover / brief media uploads
│   ├── submissionService.ts      # Submit + report + winner marking
│   ├── groupService.ts           # Group CRUD + join requests + memberships
│   ├── reportService.ts          # Submission reports
│   ├── notificationsService.ts   # In-app inbox feed
│   ├── preferencesService.ts     # User preferences doc
│   ├── pushService.ts            # Expo push token registration + foreground handler
│   └── imageUploadService.ts     # Generic Firebase Storage upload + image compression
├── constants/
│   ├── queryKeys.ts              # Centralized TanStack key factory under `qk` (bounties / submissions / groups / profiles / wallet / notifications / preferences)
│   ├── storageKeys.ts            # AsyncStorage keys
│   ├── featureGates.ts           # SOLANA_NETWORK / SOLANA_RPC_URL / SOLANA_EXPLORER_BASE / IS_DEVNET_LIKE / PROTOCOL_FEE_BPS / computeFeeLamports / computeFeeSol / SOLANA_CHAIN_ID
│   └── escrow.ts                 # V1_PROGRAM_ID, SUBMISSION_WINDOW_SECS (30d), REVIEW_WINDOW_SECS (90d), MAX_SUBMISSIONS_PER_USER
├── types/
│   ├── bounty.ts                 # Bounty, BountyStatus, BountyScope, BountySubmissionKind
│   ├── submission.ts             # Submission, SubmissionStatus
│   ├── group.ts                  # Group, GroupMember, JoinRequest
│   ├── profile.ts                # Profile, location, push prefs
│   ├── notification.ts
│   └── preferences.ts
└── utils/
    ├── cn.ts                     # Tailwind class merger
    ├── dates.ts · formatNumber.ts · firestoreTimestamp.ts · firestore.ts · array.ts
    ├── withTimeout.ts            # Promise timeout wrapper
    ├── toast.ts                  # Centralized toast API
    ├── haptic.ts                 # Haptic vocabulary
    ├── avatars.ts                # Avatar URL resolver
    └── copy.ts                   # Centralized empty-state strings

constants/                        # Top-level theme / layout tokens
├── ThemePalettes.ts              # MONO_PALETTE + invertPalette + Accent palette
├── ThemeColors.ts                # Semantic tokens
├── NeutralColors.ts              # Theme-invariant white/black/whiteSoft/blackSoft
├── StatusColors.ts               # success / error / warning / info
├── LayoutConstants.ts            # TAB_BAR_HEIGHT, BottomInset, AnimationDuration
├── TailwindColors.ts             # Tailwind palette references
└── Colors.ts

functions/
├── index.js                      # mintFirebaseToken, solanaRpcProxyDevnet/Mainnet, expireBounties, push fan-out
├── idl.json                      # IDL mirror for server-side escrow reconciliation
└── package.json
```

## Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `profiles/{userId}` | Profile (username, displayName, bio, avatarUrl, walletAddress, location, dmContact, pushToken) — userId == Privy user id == Firebase auth uid |
| `usernames/{slug}` | Unique-username sentinel (transactional reservation on profile create) |
| `bounties/{id}` | Poster-funded bounties (posterId, posterWalletAddress, contractIdHex, bountyLamports, submissionKind (photo/video/link), scope (public/group), groupId, submissionEndsAt (createdAt + 30d), expiresAt (submissionEndsAt + 90d), status (open/in_review/cancelling/hidden/settled/refunded), winnerId, winningSubmissionId, txSignature, escrowFunded, submissionCount, reportCount) |
| `submissions/{id}` | Submissions to bounties (bountyId, submitterId, mediaUrls, status) — `MAX_SUBMISSIONS_PER_USER = 1` |
| `reports/{id}` | Moderator reports against submissions |
| `groups/{id}` | Curated audience groups (host posts bounties scoped to a group) |
| `groupMembers/{compoundId}` | Membership join-table (`<groupId>_<userId>`) |
| `joinRequests/{id}` | Pending requests to join groups |
| `groupCreationRequests/{id}` | Pending requests to create new groups |
| `notifications/{id}` | In-app inbox feed |
| `preferences/{uid}` | Per-user preferences |

## Navigation

**4 bottom tabs** rendered by the custom `TabBar` (`components/ui/TabBar.tsx`): **Browse**, **Inbox**, **Wallet**, **Profile**. No oversized center action — "Create bounty" is launched via the `PostBountySheet` opened from Browse / FAB.

**Two-state routing** (`app/index.tsx`):
- No Privy user → `/(auth)/sign-in`
- Privy user → `/(home)/(tabs)/browse`

Profile bootstrap happens inside `UserContext` on first sign-in (default `location: 'global'`). There is no `role-select` step — bounties have a single role model (anyone can post and anyone can submit).

## Provider Tree

Root layout (`app/_layout.tsx`) nests providers in this order (outermost → innermost):

```
ErrorBoundary
  GestureHandlerRootView
    PrivyProvider
      QueryProvider (TanStack Query)
        ThemeProvider
          AuthProvider               # bridges Privy → Firebase
            OfflineBanner             # sibling of UserProvider
            UserProvider
              Slot
              ToastManager (overlay)
```

## State Management

**TanStack Query** (server state):
- Query key factory: `lib/constants/queryKeys.ts` (centralized under `qk`)
- Wallet balance: refetched every 30s
- Browse feed: `qk.bounties.listPublic(status)` / `qk.bounties.listGroup(groupIds, status)`

**React Context** (global):
- `AuthContext` — Privy + Firebase auth state, `walletAddress`, `runIfOnline`, NetInfo debounce
- `UserContext` — cached profile, manual `refreshProfile`
- `ThemeContext` — theme name + light/dark palette
- `OverlaySheetsContext` — shared bottom-sheet handles

**Local state** (component): useState for forms, sheets, transient UI.

## Bounty Lifecycle (Solana, devnet, SOL only)

Funds live in a PDA-derived escrow account; no separate "order" doc.

1. **Create**: UI calls `useBountyEscrow().post(input)`.
   - `bountyService.draftBounty` reserves a Firestore doc id + generates `contractIdHex` + computes `submissionEndsAt = now + SUBMISSION_WINDOW_SECS` (30d) and `expiresAt = submissionEndsAt + REVIEW_WINDOW_SECS` (90d).
   - `escrow.createBounty` builds the `create_bounty` instruction (config PDA, escrow PDA, poster pubkey) and submits via Privy's embedded wallet provider.
   - On success, `bountyService.persistBounty` writes the bounty doc with `status: 'open'` and `escrowFunded: true`.
2. **Submit**: submitters upload media → `submissionService.createSubmission` writes the doc. Hard cap: 1 submission per user per bounty.
3. **Settle (manual, only mode)**: after `submissionEndsAt`, status flips to `in_review`. Poster picks a winner → `useBountyEscrow().settleManual` calls `settle_manual_bounty` (winner gets amount − 0.5% protocol fee, fee goes to `feeTreasury`) → `bountyService.markManualSettled` updates the doc to `settled`.
4. **Cancel**: poster, while bounty has no submissions → `useBountyEscrow().cancel` flips Firestore to `cancelling`, runs `cancel_bounty`, finalizes to `refunded`. On failure, status is reverted via `abortCancel` or swept by the `expireBounties` Cloud Function.
5. **Refund**: anyone, after `expiresAt`, no winner picked → `refund_bounty` returns funds to poster; doc flips to `refunded`.

Protocol fee: **0.5%** (`PROTOCOL_FEE_BPS = 50`) — computed on-chain at settlement; client estimates via `computeFeeLamports` / `computeFeeSol` for receipts. Settlement is manual-only; there is no auto / AI-verifier path (dropped in commit a1dae7d).

## Settings Screen Conventions

All `app/(home)/settings/*.tsx` screens follow the same patterns so the area reads as one product:

- **Section headers** use `<SectionLabel label="..." />` from `components/base/SectionLabel.tsx` (small caps, muted, wide tracking). Never an `h*` heading.
- **Toasts** go through `toast` from `@/lib/utils/toast` (not `Toast` from `toastify-react-native` directly). Methods: `success`, `error`, `info`, `warn`, `hide`.
- **Row trailing icon** signals outcome:
  - `chevron` → navigates to a screen (default in `<SettingItem>`).
  - `external` → opens an external URL.
  - `none` → triggers an action with no navigation (modal, system overlay, sheet).
- **Padding**:
  - List-style screens (rows of `Card variant="border-bottom"`): scroll wrapper has `pt-lg`, NO `px-screen` — rows handle their own horizontal padding.
  - Form-style screens (single-column inputs): scroll wrapper has `px-screen pt-lg`.

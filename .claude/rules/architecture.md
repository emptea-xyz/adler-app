# Adler — App Architecture

## Tech Stack

- **Framework**: Expo 55 + React Native 0.83 + Expo Router (file-based routing). iOS-only target — `app.json` platforms = `["ios", "web"]`.
- **Language**: TypeScript (strict mode, `@` path alias = project root)
- **Styling**: NativeWind 4 (Tailwind CSS for RN), class builder via `cn()` in `lib/utils/cn.ts`
- **State**: TanStack Query 5 (server state) + React Context (global state) + useState (local)
- **Auth**: Privy (`@privy-io/expo`) with embedded Solana wallets, bridged to Firebase Auth via a Cloud Function
- **Payments**: Anchor program `adler-escrow` on Solana devnet — funded bounty escrows, manual settlement (poster picks winner), refund + cancel paths
- **Backend**: Firebase 12 (Firestore + Storage + Functions). No analytics/crash reporting on the client in v1.
- **Animations**: `react-native-reanimated` 4 + `@shopify/react-native-skia` (TabBar, EagleLoader)
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
app/
├── (auth)/sign-in.tsx
├── (home)/
│   ├── (tabs)/        browse · inbox · wallet · profile
│   ├── bounty/[id].tsx · [id]/submit.tsx
│   ├── notifications.tsx · wallet/activity.tsx
│   └── settings/      account · profile · notifications · about · index
├── _layout.tsx        root provider tree (see § Provider Tree)
├── +not-found.tsx
└── index.tsx          two-state routing (see § Navigation)

components/
├── base/      ThemedText/View · ScreenHeader · ErrorBoundary · OfflineBanner · SectionLabel · LoadingScreens
├── ui/        Button · Card · BottomSheet · Skeleton · NumberInput · TextInput · Avatar · Alert · EmptyState · PopoverMenu · Pill · SegmentedToggle · ToastConfig · TabBar · ActionTile · CircleIconButton · AdlerEagleLogo · EagleLoader · Icon · SolanaIcon
└── features/
    ├── account/       DeleteAccountSheet · SignOutSheet
    ├── bounty/        BountyItemCard · BountyStatusIcon · BountyTags · PostBountySheet
    ├── groups/        GroupsSearchSheet
    ├── home/          AdlerHomeHeader
    ├── notifications/ PushPermissionPrompt
    └── wallet/        ConnectivitySheet · ReceiveSheet · SendSheet

contexts/    Auth · User · Theme · OverlaySheets · QueryProvider
hooks/       useBounty · useBountyEscrow · useDebounce

lib/
├── firebase/   config.ts (Auth + Firestore + Storage + Functions)
├── solana/     connection · transferSol
├── anchor/     idl · idl-types · program · useFeeTreasury
├── escrow/     _send · _build · pda · instructions (create / settleManual / refund / cancelBounty)
├── services/   privyAuth · profile · bounty · bountyMediaUpload · submission · group · report · notifications · preferences · push · imageUpload
├── constants/  queryKeys · storageKeys · featureGates · escrow
├── types/      bounty · submission · group · profile · notification · preferences
└── utils/      cn · dates · formatNumber · firestoreTimestamp · firestore · array · withTimeout · toast · haptic · avatars · copy

constants/   ThemePalettes · ThemeColors · NeutralColors · StatusColors · LayoutConstants · TailwindColors · Colors
functions/   index.js · idl.json · package.json
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

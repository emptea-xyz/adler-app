# Adler — App Architecture

## Tech Stack

- **Framework**: Expo 55 + React Native 0.83 + Expo Router (file-based routing)
- **Language**: TypeScript (strict mode, `@` path alias = project root)
- **Styling**: NativeWind 4 (Tailwind CSS for RN), class builder via `cn()` in `lib/utils/cn.ts`
- **State**: TanStack Query 5 (server state) + React Context (global state) + useState (local)
- **Auth**: Privy (`@privy-io/expo`) with embedded Solana wallets, bridged to Firebase Auth via a Cloud Function
- **Payments**: `@solana/web3.js` against Solana **devnet** — direct SOL transfers from the buyer's embedded wallet
- **Backend**: Firebase 12 (Firestore + Storage + Functions). No analytics/crash reporting on the client in v1.
- **Charts**: `@shopify/react-native-skia` — generic primitives at `components/ui/charts/` (kept for future analytics dashboards)
- **Animations**: `react-native-reanimated` 4
- **Icons**: `lucide-react-native`
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
├── (auth)/                       # Pre-auth + role-pick
│   ├── _layout.tsx
│   ├── sign-in.tsx               # Privy email-OTP login
│   └── role-select.tsx           # Pick Creator or Brand on first sign-in
├── (home)/                       # Authenticated app (gated by AuthContext + UserContext)
│   ├── _layout.tsx               # Routes guard: needs user + profile.role
│   ├── (tabs)/                   # Browse / Inbox / Create / Profile
│   ├── package/[id].tsx          # Package detail
│   ├── gig/[id].tsx              # Gig detail (with applications + award flow)
│   ├── checkout.tsx              # Solana payment confirmation modal
│   ├── order/[id].tsx            # Order receipt + tx signature
│   └── settings/                 # wallet, role-switch, sign-out
├── _layout.tsx                   # Root: PrivyProvider → QueryProvider → ThemeProvider → AuthProvider → UserProvider
├── +not-found.tsx
└── index.tsx                     # Three-state routing: no-user → sign-in, no-role → role-select, has-role → browse

components/
├── base/                         # ThemedText, ThemedView, ScreenHeader, ErrorBoundary, OfflineBanner, SectionLabel, LoadingScreen, InitialLoadingScreen, LoadingMotive
├── ui/                           # Generic primitives (Button, Card, BottomSheet, Skeleton, NumberInput, TextInput, Avatar, Dropdown, Alert, EmptyState, ErrorState, FadeTransition, ScreenFadeIn, HapticRefreshControl, PopoverMenu, ProgressBar, SegmentedToggle, ToastConfig, UnderlineTabBar, AdlerTabBar)
│   ├── charts/                   # Skia-based: BarChart, DonutChart, CalendarHeatmap (+ primitives, hooks, utils)
│   └── icons/                    # ArrowProgress (only)
└── features/
    └── home/AdlerHomeHeader.tsx  # Greeting + role chip + live SOL balance pill (Browse top)

contexts/
├── AuthContext.tsx               # Privy ↔ Firebase orchestration, runIfOnline, NetInfo debounce
├── UserContext.tsx               # Profile loader, hasRole helper, SWR cache via AsyncStorage
├── ThemeContext.tsx              # Theme palette + dark mode (mono ↔ inverted)
└── QueryProvider.tsx             # TanStack Query client

hooks/
├── useAsyncState.ts
├── useDebounce.ts
└── useSolanaPayment.ts           # Wraps payForListing with the Privy embedded wallet provider

lib/
├── firebase/config.ts            # Firebase Auth + Firestore + Storage + Functions singleton
├── solana/
│   ├── connection.ts             # devnet `Connection` + lamport↔SOL helpers + explorer URLs
│   └── transferSol.ts            # Build, sign, send a SystemProgram.transfer via Privy wallet provider
├── services/
│   ├── privyAuthService.ts       # Privy JWT → Firebase custom token + signInWithCustomToken
│   ├── profileService.ts         # ensureProfileExists (transactional), setRole, updateProfile, setWalletAddress
│   ├── packageService.ts         # CRUD + listActivePackages / listPackagesBySeller
│   ├── gigService.ts             # CRUD + listOpenGigs / listGigsByBrand
│   ├── applicationService.ts     # applyToGig + status updates (pending/shortlisted/awarded/rejected)
│   ├── orderService.ts           # createPendingOrder → markOrderPaid (atomic with on-chain settle)
│   ├── paymentService.ts         # End-to-end pay flow (resolve seller wallet, write pending order, transfer, mark paid)
│   └── imageUploadService.ts     # Generic Firebase Storage upload + image compression
├── constants/
│   ├── queryKeys.ts              # PROFILE / PACKAGE / GIG / APPLICATION / ORDER / FEED key factories
│   ├── storageKeys.ts            # CACHED_PROFILE, ACCENT_COLOR, COLOR_SCHEME
│   └── featureGates.ts           # SOLANA_NETWORK, SOLANA_RPC_URL, SOLANA_EXPLORER_BASE
└── utils/
    ├── cn.ts                     # Tailwind class merger
    ├── dates.ts                  # Date formatting helpers
    ├── formatNumber.ts           # Number formatting
    ├── withTimeout.ts            # Promise timeout wrapper
    ├── toast.ts                  # Toast API
    ├── haptic.ts                 # Haptic vocabulary (light / medium / heavy / etc.)
    ├── firestore.ts              # Firestore helpers
    ├── array.ts                  # Array utilities
    ├── avatars.ts                # Avatar URL resolver (passthrough)
    ├── chartNarrative.ts         # Accessibility narrative stubs (no-op for v1)
    └── copy.ts                   # Centralized empty-state strings

types/
├── marketplace.ts                # Profile, PackageListing, Gig, GigApplication, Order, Review, FeedItem
├── components.ts                 # ComponentSize / Variant / Status helpers
├── navigation.ts                 # BottomTabDescriptor + Expo Router types
└── svg.d.ts

constants/                        # Top-level theme / layout tokens
├── ThemePalettes.ts              # THEME_COLORS + invertPalette + SIGNAL_COLORS slots
├── ThemeColors.ts                # Semantic tokens
├── LayoutConstants.ts            # TAB_BAR_HEIGHT, BottomInset, AnimationDuration
├── ComponentTheme.ts
├── TailwindColors.ts             # Tailwind palette references
└── Colors.ts

functions/
├── index.js                      # mintFirebaseToken (Privy → Firebase custom token bridge)
└── package.json                  # `@privy-io/server-auth`, firebase-admin, firebase-functions
```

## Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `profiles/{userId}` | Profile (role, username, displayName, bio, avatarUrl, walletAddress) — userId == Privy user id == Firebase auth uid |
| `packages/{id}` | Creator-listed content packages (sellerId, title, description, priceSol, deliverables, mediaUrls, category, status) |
| `gigs/{id}` | Brand-posted gigs (brandId, title, description, budgetSol, deadline, requirements, category, status) |
| `gigApplications/{id}` | Creator applications to gigs (gigId, creatorId, message, sampleUrls, status) |
| `orders/{id}` | Settled marketplace transactions (type, referenceId, buyerId, sellerId, amountSol, txSignature, status) |
| `reviews/{id}` | Post-order reviews (orderId, reviewerId, revieweeId, rating, comment) |

## Navigation

**4 bottom tabs**: Browse, Inbox, Create, Profile — rendered by the custom `AdlerTabBar` (3 standard tabs + an oversized circular center action for Create).

**Three-state routing** (`app/index.tsx`):
- No Privy user → `/(auth)/sign-in`
- Privy user, no `profile.role` → `/(auth)/role-select`
- Privy user with role → `/(home)/(tabs)/browse`

`AuthContext` debounces routing via `previousUserRef` / `hasRoutedRef` — extend the comparison key to `${user?.id}:${profile?.role ?? 'none'}` if you add a fourth state.

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
- Query key factory: `lib/constants/queryKeys.ts` (`PROFILE_KEYS`, `PACKAGE_KEYS`, `GIG_KEYS`, `APPLICATION_KEYS`, `ORDER_KEYS`, `FEED_KEYS`)
- Wallet balance: refetched every 30s, staleTime 15s
- Mixed Browse feed: parallel `getDocs` on `packages` + `gigs`, merge-sorted by `createdAt`

**React Context** (global):
- `AuthContext` — Privy + Firebase auth state, `walletAddress`, `runIfOnline`, NetInfo debounce
- `UserContext` — cached profile + `hasRole`, manual `refreshProfile`
- `ThemeContext` — theme name + light/dark + invertable palette

**Local state** (component): useState for forms, sheets, transient UI.

## Payment Flow (Solana, devnet, SOL only)

Direct transfer at purchase — no escrow in v1.

1. UI calls `useSolanaPayment().pay({ type, referenceId, sellerId, amountSol })`.
2. `paymentService.payForListing` resolves the seller's `walletAddress` from their profile.
3. **Order doc written first** with `status: 'pending'` and `txSignature: null` (so we have a record of intent even if the app crashes mid-tx).
4. `transferSol` builds a `SystemProgram.transfer`, requests Privy's `EmbeddedSolanaWalletProvider` to sign + send, returns the signature.
5. On success, the order is updated to `status: 'paid'` with the signature.
6. On failure, the order remains `pending` for a future reconciler (out of scope for v1).

For Gigs: payment fires when a brand awards an applicant (`updateApplicationStatus(applicationId, 'awarded')` + `updateGigStatus(gigId, 'awarded')`).

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

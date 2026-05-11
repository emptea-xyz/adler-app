# Adler Blueprint

A reusable spec for the architecture and design language behind Adler. Lift this into a new app to inherit the same industrial-precision aesthetic and the same Privy + Firebase + Solana payment topology.

The philosophy in one line: **a purpose-built instrument, not a lifestyle brand.** Stripe Dashboard density meets cockpit-gauge clarity. Every pixel earns its place.

---

## Part 1 — Architecture

### Stack (load-bearing)

| Layer | Choice |
|---|---|
| Framework | Expo 55 + React Native 0.83 + Expo Router (file-based) |
| Language | TypeScript strict, `@` alias = repo root |
| Styling | NativeWind 4 + `cn()` helper, theme tokens via `useTheme()` |
| Server state | TanStack Query 5 (staleTime tuned per resource) |
| Global state | React Context (auth, user, theme) |
| Local state | `useState` |
| Auth | Privy embedded Solana wallets → Firebase Auth bridge |
| Payments | `@solana/web3.js` + `@coral-xyz/anchor` against Solana **devnet** — Anchor escrow program (`adler-escrow`) |
| Backend | Firebase 12 (Firestore + Storage + Functions + App Check) |
| Skia | `@shopify/react-native-skia` — TabBar, ProgressBar, EagleLoader, ArrowProgress |
| Animations | `react-native-reanimated` 4 |
| Icons | `lucide-react-native` (always 1:1 from source SVG) |
| Fonts | Geist 400 + 600 via `expo-google-fonts` |
| Haptics | `expo-haptics` wrapped in `lib/utils/haptic.ts` |
| Platforms | iOS-only (web works via `react-native-web`); never Android |

### Polyfill order (`index.js`)

Order matters — `@solana/web3.js` will misbehave if any of these load late:

```js
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import 'fast-text-encoding';
import '@ethersproject/shims';

import 'expo-router/entry';
```

Do **not** add `react-native-quick-crypto` — Privy's native layer handles signing for SOL transfers.

### Provider tree (root layout)

```
ErrorBoundary
  GestureHandlerRootView
    PrivyProvider
      QueryProvider                  # TanStack Query
        ThemeProvider
          AuthProvider               # bridges Privy → Firebase
            OfflineBanner
            UserProvider             # cached profile + role helpers
              Slot                   # Expo Router
              ToastManager           # overlay
```

`ErrorBoundary` deliberately mounts above `ThemeProvider` so a context crash still renders a fallback. It is the only place in the app allowed to hardcode hex.

### Auth bridge (Privy → Firebase)

1. Client signs in with Privy (email OTP).
2. `usePrivy().getAccessToken()` returns the Privy JWT.
3. Client calls Cloud Function `mintFirebaseToken({ accessToken })`.
4. Function verifies via `@privy-io/server-auth`, mints a Firebase custom token with `uid = privy.userId`.
5. Client calls `signInWithCustomToken(auth, customToken)`.

`AuthContext` orchestrates this. `userId` is always the Privy user id, which equals the Firebase auth uid. Firestore rules use `request.auth.uid == <userId>`.

### Two-state routing (`app/index.tsx`)

| State | Destination |
|---|---|
| No Privy user | `/(auth)/sign-in` |
| Privy user | `/(home)/(tabs)/browse` |

Profile bootstrap happens inside `UserContext` on first sign-in (sane defaults — pickable later via `/settings/profile`). There is no role-select gate.

### Directory layout

```
app/                              # Expo Router (file-based)
├── (auth)/                       # Pre-auth
│   └── sign-in.tsx               # Privy email-OTP
├── (home)/                       # Authenticated app, gated by AuthContext
│   ├── (tabs)/                   # Browse / Inbox / Wallet / Profile
│   ├── bounty/[id].tsx           # Bounty detail + submissions + settle / refund / cancel
│   ├── bounty/[id]/submit.tsx    # Submission composer
│   ├── notifications.tsx
│   ├── wallet/activity.tsx
│   └── settings/                 # index, account, profile, notifications, about
├── _layout.tsx                   # provider tree
└── index.tsx                     # two-state router

components/
├── base/                         # ThemedText, ThemedView, ScreenHeader, ErrorBoundary, OfflineBanner, SectionLabel, LoadingScreen, InitialLoadingScreen
├── ui/                           # Generic primitives (Button, Card, BottomSheet, Skeleton, NumberInput, TextInput, Avatar, Dropdown, Alert, EmptyState, ErrorState, PopoverMenu, Pill, ProgressBar, SegmentedToggle, ToastConfig, TabBar, ActionTile, CircleIconButton, AdlerEagleLogo, EagleLoader, Icon, SolanaIcon)
│   └── icons/                    # ArrowProgress
└── features/                     # account, bounty, groups, home, notifications, wallet

contexts/
├── AuthContext.tsx               # Privy + Firebase orchestration, walletAddress, runIfOnline, NetInfo debounce
├── UserContext.tsx               # Profile loader + AsyncStorage SWR cache
├── ThemeContext.tsx              # Theme palette + dark mode flip
├── OverlaySheetsContext.tsx      # Imperative open/close for shared bottom sheets
└── QueryProvider.tsx             # TanStack Query client

hooks/
├── useBounty.ts                  # Single-bounty query
├── useBountyEscrow.ts            # post / settleManual / refund / cancel — wraps Firestore + on-chain escrow
└── useDebounce.ts

lib/
├── firebase/config.ts            # singleton: Auth + Firestore + Storage + Functions + App Check
├── solana/                       # connection, transferSol (used by Send sheet)
├── anchor/                       # idl, idl-types, program (getProgram<AdlerEscrow>), useFeeTreasury
├── escrow/                       # _send, pda, createBounty, settleManualBounty, refundBounty, cancelBounty
├── services/                     # privyAuthService, profileService, bountyService, bountyMediaUploadService, submissionService, groupService, reportService, notificationsService, preferencesService, pushService, imageUploadService
├── constants/                    # queryKeys (qk), storageKeys, featureGates, escrow
├── types/                        # bounty, submission, group, profile, notification, preferences
└── utils/                        # cn, dates, formatNumber, firestoreTimestamp, withTimeout, toast, haptic, firestore, array, avatars, copy

constants/                        # ThemePalettes, ThemeColors, NeutralColors, StatusColors, TailwindColors, LayoutConstants
functions/                        # mintFirebaseToken, solanaRpcProxy{Devnet,Mainnet}, expireBounties, push fan-out
```

### Firestore schema

| Collection | Purpose |
|---|---|
| `profiles/{uid}` | username, displayName, bio, avatarUrl, walletAddress, location, dmContact, pushToken. `uid == Privy user id == Firebase auth uid`. |
| `usernames/{slug}` | Unique-username sentinel (transactional reservation). |
| `bounties/{id}` | posterId, contractIdHex, amountLamports, mode (`manual`/`auto`), submissionKind, scope (`public`/`group`), groupId, submissionEndsAt, expiresAt, status (`open`/`cancelling`/`refunded`/`settled`/`cancelled`). |
| `submissions/{id}` | bountyId, submitterId, mediaUrls, status. Hard cap 1 per user per bounty. |
| `reports/{id}` | Moderator reports against submissions. |
| `groups/{id}` · `groupMembers/{compoundId}` · `joinRequests/{id}` · `groupCreationRequests/{id}` | Curated audience groups + memberships. |
| `notifications/{id}` · `preferences/{uid}` | Inbox feed + user preferences. |

Backend rules + Cloud Functions are the contract. Never redeploy backend from mobile.

### Bounty lifecycle (Anchor escrow)

1. `useBountyEscrow().post` reserves a Firestore draft (id + `contractIdHex` + `submissionEndsAt` + `expiresAt`), submits `create_bounty` via the embedded Privy wallet, then persists the bounty doc as `open`.
2. Submissions: `submissionService.createSubmission`. `MAX_SUBMISSIONS_PER_USER = 1`.
3. **Manual settlement**: `useBountyEscrow().settleManual` → `settle_manual_bounty` (winner gets amount − 0.5% fee, fee to `feeTreasury`) → `markManualSettled`.
4. **Cancel** (poster, no submissions): flips Firestore to `cancelling` → `cancel_bounty` → `finishCancel`. On client failure `abortCancel` reverts; otherwise swept by `expireBounties` Cloud Function.
5. **Refund** (post-`expiresAt`, no winner): anyone calls `refund_bounty` — funds return to poster.

Protocol fee `PROTOCOL_FEE_BPS = 50` (0.5%) — computed on-chain. Client estimates via `computeFeeLamports` / `computeFeeSol` for receipts.

### State management

- **Server state** — TanStack Query. Centralized key factory under `qk` in `lib/constants/queryKeys.ts` (`qk.bounties.*`, `qk.submissions.*`, `qk.groups.*`, `qk.profiles.*`, `qk.wallet.*`, `qk.notifications.*`, `qk.preferences.*`). Wallet balance refetches every 30s.
- **Global** — `AuthContext` (auth state + `walletAddress` + `runIfOnline` + NetInfo debounce), `UserContext` (cached profile + manual `refreshProfile`), `ThemeContext` (theme name + light/dark + invertable palette), `OverlaySheetsContext` (shared bottom-sheet handles).
- **Local** — `useState` for forms, sheets, transient UI.

### Navigation shell

4 bottom tabs via the custom `TabBar`: **Browse**, **Inbox**, **Wallet**, **Profile**. "Create bounty" is launched via the `PostBountySheet` opened from Browse — no oversized center action.

---

## Part 2 — Design Language

### Color system (four palettes, no overlap)

Each palette has exactly one role. Never swap them.

#### 1. Theme-aware neutrals — `theme[N]` from `useTheme()`

The bulk of the UI. One palette (pure neutrals); two appearances (light/dark) produced by inverting at render time via `invertPalette()`.

| Shade | Role |
|---|---|
| `theme[50]` | App background, lightest surfaces |
| `theme[100–200]` | Card backgrounds, subtle borders |
| `theme[300–400]` | Tertiary text, placeholders, disabled states |
| `theme[500]` | Muted secondary text — the most common "quiet" color (`#737373`) |
| `theme[600–700]` | Emphasis text, icons |
| `theme[800–900]` | Primary text, headings |
| `theme[950]` | Darkest elements |

Sourced from `TailwindColors.neutral`. Shade 500 stays in place when inverted.

#### 2. Theme-invariant neutrals — `Neutral` from `constants/NeutralColors.ts`

For foregrounds over a brand-colored background that doesn't itself flip. Use these for icon foregrounds on `Accent`/`Status` buttons, shadow colors, anywhere a `'#fff'` literal would otherwise creep in.

```ts
Neutral.white = '#ffffff'
Neutral.black = '#000000'
Neutral.whiteSoft = '#fafafa'
Neutral.blackSoft = '#0a0a0a'
```

#### 3. Brand accents — `Accent` from `constants/ThemePalettes.ts`

Category chips, illustrative highlights, decorative pops. Theme-independent — render identically in light and dark mode. Pulled 1:1 from a `accent/*` Figma collection.

```ts
Accent.pink   = '#ff0088'
Accent.cyan   = '#00d4ff'   // blue
Accent.lime   = '#4cd900'   // green
Accent.orange = '#ff5900'
Accent.sable  = '#f1c917'   // yellow
Accent.pinkDark = '#be185d' // gradient companion only
```

#### 4. Semantic status — `Status` from `constants/StatusColors.ts`

```ts
Status.success = '#10b981'
Status.error   = '#f43f5e'
Status.warning = '#f97316'
Status.info    = '#0ea5e9'
```

#### Destructive — `#DC143C` literal

Irreversible actions only (delete, sign out). Distinct from `Status.error`: error means "something went wrong," destructive means "you are about to lose data."

#### Rules of the road

- Hex literals are **forbidden** except `#DC143C` and the `ErrorBoundary` fallback.
- A green checkmark is `Status.success`, **not** `Accent.lime`.
- A category chip is `Accent.pink`, **not** `Status.error`.
- Never rely on hue alone for status — pair every color with an icon, weight, or label.
- Standard text contrast ≥ 4.5:1; large text and icons ≥ 3:1.
- For multi-series charts, pair blue with **orange** for color-blind safety.
- Never render pure black on pure white; use `theme[950]` on `theme[50]`.

### Typography

**Geist** Regular (400) + SemiBold (600) via `expo-google-fonts`. Fallback in Figma is **Inter**. Tracking: `-0.03em` everywhere (`tracking-adler` in NativeWind).

Defined as variants in `components/base/ThemedText.tsx`. Use the `type` prop, never inline font sizes.

| Variant | Family | Size / Line | Default color |
|---|---|---|---|
| `h1` | SemiBold | 48 / 56 | `theme[950]` |
| `h2` | SemiBold | 36 / 44 | `theme[950]` |
| `h3` | SemiBold | 28 / 36 | `theme[950]` |
| `h4` | SemiBold | 24 / 32 | `theme[950]` |
| `h5` | SemiBold | 20 / 28 | `theme[950]` |
| `h6` | SemiBold | 18 / 26 | `theme[950]` |
| `body-3xl` / `body-3xl-semibold` | Regular / SemiBold | 24 / 32 | `theme[950]` |
| `body-2xl` / `body-2xl-semibold` | … | 20 / 28 | `theme[950]` |
| `body-xl`  / `body-xl-semibold`  | … | 18 / 26 | `theme[950]` |
| `body-lg`  / `body-lg-semibold`  | … | 16 / 24 | `theme[950]` (default body) |
| `body-md`  / `body-md-semibold`  | … | 14 / 20 | `theme[950]` |
| `body-sm`  / `body-sm-semibold`  | … | 13 / 18 | `theme[500]` |
| `body-xs`  / `body-xs-semibold`  | … | 12 / 16 | `theme[500]` |
| `caption` / `caption-semibold`   | … | 11 / 14 | `theme[500]` |
| `label`   / `label-semibold`     | … | 11 / 14 | `theme[500]` |

#### Capitalization

- **ALL CAPS** is prohibited for body text or descriptions — uniform rectangular blocks destroy word-shape recognition.
- ALL CAPS is allowed for short labels, badges, single-word emphasis (`PACKAGE`, `GIG`, `DEVNET`, `CREATOR`, `BRAND`). Pair with `caption-semibold` and ~0.6 letterSpacing for breathing room.

#### Metrics

Bring figures and units tight: `0.5 SOL`, never `0.5  SOL`. Align operators vertically with numbers.

### Spacing & radius (Tailwind tokens)

Defined in `tailwind.config.js`, mirrored by `LayoutConstants.ts`. Semantic aliases override raw scale numbers.

| Spacing token | Value | Use |
|---|---|---|
| `xs` | 4px | Micro |
| `sm` | 8px | Tight |
| `md` | 12px | Compact |
| `lg` | 16px | Default |
| `xl` | 20px | Comfortable |
| `2xl` | 24px | Roomy |
| `3xl` | 32px | Section |
| `4xl` | 48px | Large section |
| `screen` | 16px | Screen horizontal padding (`px-screen`) |
| `section` | 24px | Gap between sections (`gap-section`) |
| `item` | 8px | Gap between list items (`gap-item`) |

| Radius token | Value | Use |
|---|---|---|
| `xs` | 4px | Subtle |
| `sm` | 8px | Tags |
| `md` | 12px | Buttons |
| `lg` | 16px | Cards |
| `xl` | 20px | Sheets |
| `2xl` | 24px | Prominent |
| `input` | 8px | Input fields, tags |
| `button` | 12px | Buttons, action items |
| `card` | 12px | Universal card / button / input radius |
| `sheet` | 24px | Bottom sheets, modals |

### Layout constants (`constants/LayoutConstants.ts`)

```ts
TAB_BAR_HEIGHT = 60

BottomInset = {
  withTabBar:           TAB_BAR_HEIGHT + 40,
  scrollWithTabBar:     TAB_BAR_HEIGHT + 60,
  scrollWithActions:    TAB_BAR_HEIGHT + 80,
  scrollWithLargeActions: TAB_BAR_HEIGHT + 100,
  scrollMinimal:        20,
}

AnimationDuration = {
  fast: 150, normal: 200, slow: 300,
  sheet: 400, page: 500, pulse: 800,
}
```

Safe areas always come from `useSafeAreaInsets()` — never hardcode `59` (status bar) or `34` (home indicator).

### Buttons

Strict visual hierarchy. Exactly **one primary** per screen — competing primaries cause decision paralysis.

| Variant | Background | Text |
|---|---|---|
| `primary` | `theme[950]` | `theme[50]` |
| `secondary` | `theme[100]` | `theme[950]` |
| `tertiary` | `theme[200]` | `theme[950]` |
| `inline` | transparent | `theme[950]` |
| `destructive` | `#DC143C` | `theme[50]` |

Sizes: `sm` h-10 / `default` h-12 / `lg` h-14 / `icon` h-12 square.

Press animation: scale 1 → 0.95 with 100ms `Easing.out(Easing.quad)` on `pressIn`. `light` haptic on every press.

#### Labels

- Maximum **3 words**, action-oriented.
- State exactly what happens on tap: "Pay 0.5 SOL", not "Submit". "Award 1 SOL", not "Confirm".
- Modal placement: secondary button left, primary right (forward-progression).

### Cards

Six variants. Default is `outline`, 1px `theme[100]` border, `rounded-card` (12px), `p-3`.

| Variant | Background | Border | Padding |
|---|---|---|---|
| `outline` | transparent | 1px `theme[100]` | `p-3` + `rounded-card` |
| `filled` | `theme[100]` | none | `p-3` + `rounded-card` |
| `borderless` | transparent | none | none |
| `border-top` | transparent | top 1px | `pt-3` |
| `border-bottom` | transparent | bottom 1px | `pb-3` |
| `border-y` | transparent | top + bottom 1px | `py-3` |

Whitespace, not heavy borders, carries the structural rhythm. The Gestalt principle of proximity does the work.

### Tab bar

Custom `TabBar` — three standard tabs plus an oversized circular center action for Create. 60pt height + safe-area inset. Floating elements (tab bar, toasts, sheets) are absolutely positioned siblings, never baked into layout flow.

### Haptics (`lib/utils/haptic.ts`)

Use the same intensity for the same conceptual moment everywhere.

| Trigger | Intensity | Example |
|---|---|---|
| Tab press, card tap, role pill toggle | `light` | Browsing chrome |
| Pay tap, apply submit, award tap | `medium` | Confirmable action |
| Payment confirmed on-chain, award succeeded | `heavy` | Major event |
| Wallet error, transaction failed | `error` (sharp double) | Recoverable failure |
| Form complete, profile saved | `success` | Positive confirmation |

Moderation matters. Excessive vibration → sensory fatigue. Every haptic pairs with a visual state change as fallback.

### Vector and raster assets

**Rule Zero: SVGs are always taken 1:1.** No exceptions. No simplifications. No "close enough."

- Vectors: copy literal path strings from source. Lucide icons come from canonical lucide source, `strokeWidth={2}`, rounded caps/joins. Multi-part icons need every sub-path — Rule Zero says all of them, not most.
- Raster: copy the file directly, never recreate. Export at 1x/2x/3x and reference via `require()`.
- If a step would require *drawing* rather than *copying*, that's the signal you're off the rails — go back and find the source path data.

### Empty states (`lib/utils/copy.ts`)

Empty states are activation real estate, not dead ends. All copy lives in one file so it can iterate without grepping.

Required elements:
1. Empathetic, on-brand title — "Quiet on the wire", "No purchases yet"
2. Action-oriented description — what happens here, how to populate it
3. Primary CTA when relevant

Never display a blank screen or generic "No data found".

### Error handling

- **Plain language only.** No jargon, no error codes. Explain what, why, and what to do next.
- Never block a payment-in-progress UI with a full-screen modal. Inline banners or toasts for recoverable issues.
- For mid-checkout wallet/network errors: surface the error and keep the order doc `pending` so retry is possible.

| Severity | Treatment |
|---|---|
| Informational | Subtle inline indicator, auto-dismiss |
| Warning | Persistent banner with dismiss action |
| Blocking | Bottom sheet with recovery steps |
| Critical (data loss / failed payment) | Modal with two actions (retry / cancel) |

### Settings screen conventions

All screens under `app/(home)/settings/*` follow the same patterns:

- Section headers use `<SectionLabel label="…" />` (small caps, muted, wide tracking) — never an `h*` heading.
- Toasts go through `toast` from `@/lib/utils/toast` (`success`, `error`, `info`, `warn`, `hide`) — never raw `Toast` from `toastify-react-native`.
- Row trailing icon signals outcome:
  - `chevron` → navigates to a screen (default in `<SettingItem>`)
  - `external` → opens an external URL
  - `none` → triggers an action with no navigation
- Padding:
  - **List screens** (rows of `Card variant="border-bottom"`): scroll wrapper has `pt-lg`, **no** `px-screen`. Rows pad themselves.
  - **Form screens** (single-column inputs): scroll wrapper has `px-screen pt-lg`.

### Information architecture principles

1. **One screen, one thought.** Each screen answers exactly one question.
2. **Prioritization test.** If the user could see only one number before pocketing the phone, that number is in the largest type, visible without scrolling.
3. **F/Z scanning.** Decision-relevant data goes top-left, status/kind labels go top-right, descriptive content flows below.
4. **Thumb zone.** Critical CTAs live in the bottom 40% of the screen. Touch targets ≥ 44×44pt.
5. **Time-to-value: 60 seconds.** First launch → first action under 60s. Smart defaults pre-fill anything inferable.

---

## Part 3 — Porting Checklist

When lifting this style into a new app:

- [ ] Copy the `constants/` folder verbatim (`ThemePalettes`, `NeutralColors`, `StatusColors`, `TailwindColors`, `LayoutConstants`, `ThemeColors`, `ComponentTheme`).
- [ ] Copy `tailwind.config.js` — spacing tokens, radius tokens, `tracking-adler`, font families.
- [ ] Copy `components/base/ThemedText.tsx` and the typography variant table.
- [ ] Copy `components/ui/Button.tsx` and `Card.tsx`. Both are dependency-light and theme-driven.
- [ ] Copy `lib/utils/haptic.ts` and adopt the haptic vocabulary.
- [ ] Copy `contexts/ThemeContext.tsx` (depends only on `ThemePalettes`).
- [ ] Copy `lib/utils/cn.ts`, `lib/utils/toast.ts`, `lib/utils/copy.ts` skeleton.
- [ ] Mirror the provider tree and three-state routing pattern.
- [ ] Set up Geist via `expo-google-fonts`. Fallback to Inter only in Figma.
- [ ] Decide iOS-only vs cross-platform up front. iOS-only removes a class of `Platform.OS` branches.
- [ ] Adopt the four-palette discipline. No hex literals except destructive `#DC143C` and the `ErrorBoundary` fallback.
- [ ] Adopt the typography discipline. `<ThemedText type="…">` always; never inline font sizes.
- [ ] Adopt the button discipline. One primary per screen. Three-word action-oriented labels.
- [ ] Adopt Rule Zero for vectors. Copy paths verbatim from source.

Once these are in place, every new screen inherits the Adler look without thinking about it. The constraints are the design.

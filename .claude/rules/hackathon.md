# Adler — Hackathon Sprint Rules

Compressed ruleset for the submission push. Long reference docs (`ux-principles.md`, `architecture.md`, `design-code-migration.md`) are still on disk under `.claude/rules/` — read them on-demand when a question can't be answered from this file.

## Stack (load-bearing only)

- Expo 55 + RN 0.83 + Expo Router (file-based) · TypeScript strict · `@` alias = repo root
- NativeWind 4 · `cn()` helper · theme tokens via `useTheme()` from `ThemeContext`
- TanStack Query 5 (server) + Context (global) + useState (local)
- Privy embedded Solana wallets → Firebase Auth bridge via `mintFirebaseToken` Cloud Function
- Solana **devnet** · `@solana/web3.js` · direct SOL transfers (escrow lands in Step 4 of docs/PORT_PLAN.md)
- Firestore + Storage + Functions · no analytics/Sentry-only
- Skia for charts · Reanimated 4 · Lucide icons · Geist font

## iOS-only (hard rule)
Never reintroduce Android: no `Platform.OS === 'android'` branches, no Android deps, no `npm run android`, no `android/` folder. `app.json` is `["ios", "web"]`.

## Theme + tokens (no exceptions)
Each role has exactly one source of truth. Do not cross the streams.

- **Theme-aware neutrals** (root surfaces, body text, dividers — flip with light/dark): `theme[N]` from `useTheme()`.
- **Theme-invariant neutrals** (foreground contrast over a brand-colored bg that itself doesn't flip): `Neutral` from `constants/NeutralColors.ts` — `Neutral.white` `#ffffff`, `Neutral.black` `#000000`, `Neutral.whiteSoft` `#fafafa`, `Neutral.blackSoft` `#0a0a0a`. Use these for icon foregrounds on `Accent`/`Status` buttons, shadow colors, etc. Never use a raw `'#fff'` literal.
- **Brand accents** (category chips, illustrative highlights, decorative pops): `Accent` from `constants/ThemePalettes.ts` — `Accent.pink` `#ff0088`, `Accent.cyan` `#00d4ff` (blue), `Accent.lime` `#4cd900` (green), `Accent.orange` `#ff5900`, `Accent.sable` `#f1c917` (yellow). `Accent.pinkDark` exists only as the gradient companion in the upload-arrow icon. Pulled 1:1 from Figma's `accent/*` collection.
- **Semantic status** (success, error, warning, info): `Status` from `constants/StatusColors.ts` — `Status.success` `#10b981`, `Status.error` `#f43f5e`, `Status.warning` `#f97316`, `Status.info` `#0ea5e9`.
- **Destructive** (irreversible actions like delete account, sign out): the literal `#DC143C`. Distinct from `Status.error` — error means "something went wrong," destructive means "you are about to lose data."
- **Never swap roles.** A green checkmark is `Status.success`, not `Accent.lime`. A category chip is `Accent.pink`, not `Status.error`. The hues may rhyme; the semantics don't.
- **Other utility shades** (rare): `TailwindColors.<name>[500]`. Default answer is "use one of the four palettes above," not this.
- **Hex literals are forbidden** except `#DC143C` and the documented `ErrorBoundary` fallback theme (it mounts above `ThemeProvider` and must keep working when context crashes).
- Layout numbers: `LayoutConstants` (`TAB_BAR_HEIGHT`, `BottomInset`, `AnimationDuration`). Add to constants if missing — never inline a magic number.
- Safe areas: `useSafeAreaInsets()`. Never hardcode `59` or `34`.

## Routing (three-state)
1. No Privy user → `/(auth)/sign-in`
2. Privy user, no profile side set up → `<ProfileGate>` blocks (tabs); old `role-select.tsx` is being deleted in Step 2
3. Has at least one side → `/(home)/(tabs)/browse`

Tabs: Browse · Inbox · Create (oversized center) · Profile via `AdlerTabBar`.

## Firestore (v1 schema — already migrated)
- `profiles/{uid}` — `creatorProfile`/`brandProfile` sub-objects, `isCreator`/`isBrand` denorm flags, `dmContact`, `country`
- `services/{id}` (was `packages`) · `gigs/{id}` · `gigApplications/{id}` (deterministic id) · `orders/{id}` · `reviews/{id}` (deterministic id)
- Backend rules + Cloud Functions are the contract — **never redeploy backend from mobile**

## Payment flow (current — direct transfer; escrow is Step 4)
1. Order doc written first as `pending` (intent record)
2. `transferSol` via Privy `EmbeddedSolanaWalletProvider`
3. On success → flip to `paid` with `txSignature`
4. On failure → leave `pending` for future reconciler

## Buttons
- Exactly one primary per screen (full-width, solid). Secondary = ghost. Tertiary = text-only. Destructive = `#DC143C`.
- Labels ≤ 3 words, action-oriented ("Pay 0.5 SOL", "Award 1 SOL"). Modal: secondary left, primary right.

## Typography
- Geist Regular (400) + SemiBold (600) via `expo-google-fonts`
- Use `ThemedText` variants — no inline font sizes
- ALL CAPS only for short labels/badges; never body text
- Metrics tight: `0.5 SOL` not `0.5  SOL`

## Haptics (`lib/utils/haptic.ts`)
Light = tab/card tap · Medium = confirmable action · Heavy = on-chain confirmation · Sharp double = error

## Settings screen conventions
- Section headers: `<SectionLabel label="..." />` (never `h*`)
- Toasts: `toast` from `@/lib/utils/toast` (not raw `Toast`)
- Row trailing icon signals outcome: `chevron` (navigates) / `external` (URL) / `none` (action only)
- List screens: `pt-lg`, no `px-screen` (rows pad themselves). Form screens: `px-screen pt-lg`.

## SVGs are 1:1 always
Never redraw, retrace, or simplify. Copy path strings verbatim from source. No exceptions.

## What to skip during the sprint
- Don't refactor adjacent code — fix the bug, ship
- Don't write tests unless the task is the test
- Don't build abstractions for one caller
- Don't add comments unless the *why* is non-obvious
- Don't end-of-turn summarize — the diff is the summary

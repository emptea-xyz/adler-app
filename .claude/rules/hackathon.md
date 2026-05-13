# Adler — Hackathon Sprint Rules

Compressed ruleset for the submission push. Long reference docs (`ux-principles.md`, `architecture.md`, `design-code-migration.md`) are still on disk under `.claude/rules/` — read them on-demand when a question can't be answered from this file.

## Stack (load-bearing only)

- Expo 55 + RN 0.83 + Expo Router (file-based) · TypeScript strict · `@` alias = repo root
- NativeWind 4 · `cn()` helper · theme tokens via `useTheme()` from `ThemeContext`
- TanStack Query 5 (server) + Context (global) + useState (local)
- Privy embedded Solana wallets → Firebase Auth bridge via `mintFirebaseToken` Cloud Function
- Solana **devnet** · `@solana/web3.js` + `@coral-xyz/anchor` · **Anchor escrow program** (`adler-escrow`, id in `lib/constants/escrow.ts`) — funded bounties, manual settlement only (poster picks winner), refund + cancel paths
- Firestore + Storage + Functions · no analytics/Sentry on v1
- Skia for TabBar / EagleLoader · Reanimated 4 · Lucide icons · Geist font

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

## Routing (two-state)
1. No Privy user → `/(auth)/sign-in`
2. Privy user → `/(home)/(tabs)/browse`

Profile bootstrap happens inside `UserContext` on first sign-in. No `role-select` step — bounties have a single role model (anyone can post, anyone can submit).

Tabs: Browse · Inbox · Wallet · Profile via `TabBar` (`components/ui/TabBar.tsx`). "Create bounty" is launched via the `PostBountySheet` from Browse.

## Firestore (v1 schema)
- `profiles/{uid}` — username, displayName, bio, avatarUrl, walletAddress, location, dmContact, pushToken (Privy user id == Firebase auth uid)
- `usernames/{slug}` — unique-username sentinel (transactional reservation)
- `bounties/{id}` — poster-funded bounties (posterId, posterWalletAddress, contractIdHex, bountyLamports, submissionKind `photo`/`video`/`link`, scope `public`/`group`, groupId, submissionEndsAt = createdAt + 30d, expiresAt = submissionEndsAt + 90d, status `open`/`in_review`/`cancelling`/`hidden`/`settled`/`refunded`, escrowFunded, submissionCount)
- `submissions/{id}` · `reports/{id}` · `groups/{id}` · `groupMembers/{compoundId}` (`<groupId>_<userId>`) · `joinRequests/{id}` · `groupCreationRequests/{id}` · `notifications/{id}` · `preferences/{uid}`
- Backend rules + Cloud Functions are the contract — **never redeploy backend from mobile**

## Bounty lifecycle (on-chain escrow)
1. `useBountyEscrow().post` → `bountyService.draftBounty` reserves doc id + `contractIdHex` → `escrow.createBounty` runs `create_bounty` → `bountyService.persistBounty` writes the doc as `open` with `escrowFunded: true`
2. Submitters call `submissionService.createSubmission` (hard cap `MAX_SUBMISSIONS_PER_USER = 1`)
3. **Review window** opens after `submissionEndsAt` (30d post-create); status flips to `in_review`
4. **Settle (manual, only mode)**: `useBountyEscrow().settleManual` → `settle_manual_bounty` (winner gets amount − 0.5% fee, fee to `feeTreasury`) → `markManualSettled` → status `settled`
5. **Cancel** (no submissions): flips Firestore to `cancelling` → `cancel_bounty` → `finishCancel` → status `refunded`; on failure `abortCancel` reverts, otherwise swept by `expireBounties` Cloud Function
6. **Refund** (post-`expiresAt` = submissionEndsAt + 90d, no winner): anyone calls `refund_bounty` — funds return to poster, status `refunded`

No auto / AI-verifier settlement path — dropped in commit a1dae7d.

Protocol fee `PROTOCOL_FEE_BPS = 50` (0.5%) — computed on-chain; client estimates via `computeFeeLamports` / `computeFeeSol` for receipts.

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

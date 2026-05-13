# Phase 1 — Winner Share Card

## Context

Phase 1 of `feature-upgrade.md` ("virality sprint"). Every settled bounty
becomes a shareable poster — `@handle won 2 SOL on Adler` — that pushes
out of the iOS share sheet as a PNG with a QR/deep link back to the
bounty. Goal: every payout becomes acquisition. Standalone, no backend
change required.

The current trophy card on the bounty detail screen (lines 285–302 of
`app/(home)/bounty/[id].tsx`) is a single-purpose Solscan link. It
doesn't mention the winner. We redesign it into a `WonCard` that shows
winner + amount as the hero, "Share win" as the primary action, and
Solscan as a smaller link below. The card is the moment.

The actual share-card PNG is rendered off-screen via
`react-native-view-shot` and pushed into the share sheet. Phase 4 (OG
previews) will later upgrade the QR target from `adler://bounty/[id]`
to a real web URL that unfurls correctly on Twitter/Telegram.

## Decisions

| Concern | Decision | Rationale |
|--------|---------|-----------|
| Card aspect | 1080×1080 square | Works on Twitter, Telegram, IG, iMessage |
| QR target | `adler://bounty/[id]` for v1 | Universal-link version arrives in Phase 4 |
| Share trigger | Persistent button on the new `WonCard`, visible whenever `bounty.status === 'settled'` | Auto-prompting the poster after they settle is awkward — they're not the protagonist |
| Card library | New `react-native-view-shot` (needs native rebuild) | Standard, mature; Skia text rendering is brittle |
| Background | Solid `theme[950]` for v1 — Skia gradient is optional polish later | Ship structure first |
| Trophy card | Replace existing Solscan-only card with a new `WonCard` | Honors "one primary action" — Share is primary, Solscan is a subordinate link |
| Who sees Share | Anyone viewing a settled bounty — not gated to winner/poster | Each viewer is a potential amplifier |

## Files

**Created**

| File | Purpose |
|------|---------|
| `components/features/bounty/ShareWinCard.tsx` | Off-screen 1080×1080 view that gets rasterised — composes ADLER wordmark, big amount, winner handle/avatar, bounty title, QR |
| `components/features/bounty/WonCard.tsx` | In-screen settled-state card that replaces the trophy card — winner row + amount + primary "Share win" + secondary Solscan link |
| `lib/utils/shareWin.ts` | `captureAndShareWin({ ref, fileName })` → `captureRef → Share.share({ url })` |

**Modified**

| File | Change |
|------|--------|
| `package.json` | Add `react-native-view-shot` |
| `app/(home)/bounty/[id].tsx` | Add `useQuery` for winner profile (gated on `winnerId`); replace lines 285–302 (`bounty.txSignature ? …`) with `<WonCard bounty={…} winner={…} />`; mount `<ShareWinCard ref={…} />` off-screen in the same layout via `position: 'absolute', left: -10000` |
| `.claude/plans/feature-upgrade.md` | Phase 1 status + plan column |

## Existing utilities to reuse

- `lib/utils/avatars.ts` — `resolveAvatarUrl` for the winner avatar in the share card
- `lib/utils/formatNumber.ts` — `formatSol(bounty.bountyLamports / 1e9)` for the amount
- `lib/utils/haptic.ts` — `haptic('medium')` on share tap, `haptic('heavy')` on share-sheet open
- `lib/services/profileService.ts` — `getProfile(winnerId)` for the winner query
- `lib/constants/queryKeys.ts` — `qk.profiles.detail(winnerId)` (or add if missing)
- `components/ui/Avatar.tsx` — fallback-initial avatar (already used in detail screen)
- `react-native-qrcode-svg` — already at 6.3.21, used in `ReceiveSheet`
- `constants/ThemePalettes.ts` / `NeutralColors.ts` — `theme[950]` for card bg, `Neutral.white` for foreground

## Implementation order

1. Write this plan + update the index status in `feature-upgrade.md`.
2. `pnpm add react-native-view-shot` → `pnpm prebuild` → user runs `pnpm ios` once on device.
3. Winner profile query in `bounty/[id].tsx` (gated on `bounty.winnerId != null`).
4. Build `ShareWinCard.tsx` — pure RN view, 1080×1080, all tokenised.
5. Build `shareWin.ts` — capture + share orchestration.
6. Build `WonCard.tsx` — in-screen settled card.
7. Swap the trophy card in `bounty/[id].tsx`.
8. `npx tsc --noEmit`, commit, push, update index status to "done".

## Share-card visual brief (1080×1080)

- Background: `theme[950]` (no gradient v1)
- Top: small `ADLER` wordmark (Geist 600), letter-spacing 2pt, `Neutral.white` 60% opacity
- Top right: tiny "BOUNTY WON" caption, `Neutral.white` 50% opacity
- Center hero block (left-aligned, 64px from edges):
  - Big amount + SOL glyph (Geist 600, ~140pt)
  - Below: winner avatar (48px circle) + `@handle` (Geist 600, 32pt)
  - Below: bounty title, max 2 lines (Geist 400, 22pt, `Neutral.white` 70%)
- Bottom right: 160×160 QR card (white bg, 16pt corner radius) → `adler://bounty/[id]`
- Bottom left: tiny "scan to view" caption (Geist 400, 14pt, `Neutral.white` 40%)

## Verification

- On devnet, settle a bounty (Privy emulator → award winner) → bounty detail refetches.
- New `WonCard` renders with winner row, amount, and a primary "Share win" button.
- Tap Share → iOS share sheet appears with a single PNG attached.
- Open the PNG in Photos: 1080×1080, ADLER mark visible top, amount and winner readable, QR scannable.
- Scan QR with the camera on an app-having device → opens `bounty/[id]` via deep link.
- "View on Solscan" still navigates correctly.
- Dark-mode visually unchanged (the card is brand-asset, intentionally dark in both modes).
- `npx tsc --noEmit` clean.

## Risks

- `react-native-view-shot` requires a native rebuild; first install requires `pnpm ios` on the dev client.
- Off-screen rendering at high resolution can fail if the view isn't laid out before `captureRef`. Mitigation: render the card inside the live tree at `position: 'absolute', left: -10000, top: 0` with explicit width/height — guarantees layout completes before capture.
- QR scanning only works for app-having users until Phase 4 ships a web URL. Social spread happens via the image regardless.

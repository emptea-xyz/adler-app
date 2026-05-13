# Post-funding plan — Mainnet + Apple Pay + USDC

**Status:** locked behind funding. Do not execute pre-funding. This file
is the architecture spec we hand to engineering on day 1 after a round
closes.

## Goal

Turn Adler from a devnet demo into a product 18–28 year olds can use to
earn real money. The crypto layer becomes invisible: poster taps Apple
Pay, winner sees USDC in their wallet, prices read in $/€.

## Non-goals

- Cash-out to bank (deferred — winners keep USDC, on-chain).
- Multi-chain. Solana only.
- Cards-other-than-Apple-Pay. Apple Pay first; expand later if data demands.

## Decision: stablecoin = USDC on Solana mainnet

- Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (Circle, 6 decimals).
- Pinned in `ProtocolConfig` on-chain so fake-mint funding is impossible.
- Pricing displayed as USD/EUR (1 USDC ≈ $1); SOL stays only for tx fees.

## Decision: onramp = Stripe Crypto Onramp (primary), MoonPay (fallback)

- **Stripe Crypto Onramp** — cleanest API, native Apple Pay sheet, KYC
  handled, lowest fee tier, direct USDC-on-Solana delivery. Requires
  Stripe Connect crypto-partner status (apply during fundraise).
- **MoonPay** (`@moonpay/react-native-moonpay-sdk`) — fallback if Stripe
  gate isn't open in time. RN SDK ships, Apple Pay supported, USDC-Solana
  direct, ~1% higher all-in fee.
- Both ship in app; feature flag picks the active provider per build.

## Architecture

### Layer 1 — Anchor program rewrite (`adler-escrow` v2.0)

Today the program escrows lamports via `system_program::transfer`. USDC
is an SPL token, so the program needs a token-aware escrow.

| What | From | To |
|---|---|---|
| Escrow holder | `BountyEscrow` PDA holding lamports | `BountyEscrow` PDA owning a USDC ATA |
| Fund ix | `system_program::transfer` | `token::transfer` (poster ATA → escrow ATA) |
| Settle ix | lamport decrement | `token::transfer` × 2 (winner ATA + treasury ATA) |
| Refund/cancel | lamport refund + close | `token::transfer` back + `token::close_account` on the ATA |
| Config | `fee_treasury: Pubkey` | `fee_treasury: Pubkey` (ATA) + `usdc_mint: Pubkey` |
| Amount field | `amount_lamports: u64` | `amount_units: u64` (micro-USDC, 6 dec) |

PDA seed bump again (`bounty_v3`, `bounty_config_v3`) so v1 PDAs are
cleanly orphaned. New program id (fresh deploy, no upgrade authority
collision with v1 on mainnet). Effort: ~2 days incl. tests on localnet
+ devnet smoke.

### Layer 2 — Mainnet cutover

- Deploy v2 to mainnet-beta at a fresh program id.
- Initialise `ProtocolConfig` with: admin (Squads multisig — not the dev
  key), `fee_treasury` (multisig-controlled ATA), `usdc_mint`, `fee_bps = 50`.
- Mainnet RPC: paid Helius. Existing `solanaRpcProxy` Cloud Function gets
  a `solanaRpcProxyMainnet` sibling (already scaffolded).
- App Check enforcement flipped from Monitor → Enforce on the proxy.
- Upgrade authority moved to Squads multisig before public launch.

### Layer 3 — Mobile

**PostBountySheet (funding flow):**
1. User picks amount in USD ("$10").
2. Client checks poster's USDC ATA balance.
3. If balance ≥ amount → straight to `create_bounty` ix.
4. If insufficient → open onramp SDK:
   ```
   provider.open({
     walletAddress: privyWalletAddress,
     currency: 'usdc_sol',
     fiatAmount: 10,
     paymentMethod: 'apple_pay',
   })
   ```
   Native Apple Pay sheet appears (Stripe/MoonPay handles it).
5. Poll ATA balance every 3s for up to 90s.
6. Once funded → `create_bounty` ix → bounty live.

**Settle / refund / cancel:** identical UX, USDC flows under the hood.

**Display:** every SOL/lamport string in the UI becomes USD/micro-USDC.
`formatNumber.usd()` helper, `bountyLamports` → `bountyUnits`,
`computeFeeLamports` → `computeFeeUnits`.

**Tx-fee SOL:** Privy wallet still needs ~0.001 SOL for tx fees. On
first-time onramp, request 0.01 SOL alongside the USDC purchase
(Stripe/MoonPay both support multi-asset orders) so users never see a
"need SOL for fees" error.

### Layer 4 — Backend

- New Firestore field: `bounties.amountUnits` (integer micro-USDC).
  Migration: dual-write during transition, then drop `bountyLamports`.
- New Cloud Function: `onrampWebhook` — Stripe/MoonPay POSTs purchase
  completion. We mark `fundingTxComplete: true` on the bounty doc so
  the client's polling can short-circuit.
- `expireBounties` Pass 0 reconcile: same logic, just checks USDC ATA
  balance instead of lamport balance.
- Firestore rules: `bountyValidShape` updated to require
  `amountUnits > 0` and absent `bountyLamports`.

### Layer 5 — App Store compliance

- Guideline 3.1.5(a) explicitly permits crypto purchases through
  licensed third parties (Stripe/MoonPay both qualify). Adler is not
  the seller of crypto — the onramp provider is.
- App Review notes (every submission): "In-app crypto purchases route
  through [provider]. Adler does not custody, exchange, or sell
  cryptocurrency."
- Do NOT register the funding flow as an in-app purchase (would
  trigger 30% IAP cut).
- Bounty payouts are P2P USDC transfers between users — not IAP.

## Roadmap (post-funding, sequenced)

1. **Stripe Crypto partner application** (parallel — submit on day 1; gate is 2–6 weeks).
2. **Anchor v2 (USDC SPL escrow)** — 2 days dev + 2 days test.
3. **Mainnet deploy + Squads multisig handoff** — 1 day.
4. **Mobile rewrite (USD display, USDC balance, onramp SDK)** — 3 days.
5. **App Check enforce + onramp webhook** — 1 day.
6. **TestFlight beta (50 users, real $5 bounties)** — 1 week soak.
7. **App Store submission** — 1 week review buffer.

Total: ~3 weeks engineering + 4 weeks Stripe/Apple gate time = **~7
weeks from funding close to public mainnet launch**, assuming Stripe
partner gate clears in parallel.

## Open questions (resolve at funding close)

- US tax: do we collect W-9 and issue 1099-NEC at $600/yr per winner,
  or push that to the onramp? (Stripe issues 1099-K for fiat purchases;
  the payout side is on us.)
- EU: VAT on protocol fee? Likely no since it's a P2P transfer fee, but
  legal review.
- Bounty cap on funding: cap initial bounties at $100/post until we've
  seen abuse patterns. Configurable in `ProtocolConfig`.
- Refund window: 30d submission + 90d review = 120d holding period.
  Reduce to 30d total for mainnet (less capital trapped, friendlier UX)?

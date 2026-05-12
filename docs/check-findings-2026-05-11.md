# Adler — Comprehensive Check Findings (2026-05-11)

> Sources: TypeScript typecheck, ESLint, Knip, Expo doctor, npm audit,
> Firestore rules dry-run, Anchor build, plus two LLM-driven reviews
> (security + cross-cutting) over the `main..crowdcast` diff.

| Bucket | Count | Highest severity |
|---|---|---|
| 🔴 HIGH (exploitable / fund-loss) | 7 | All actionable now |
| 🟡 MEDIUM (defensive miss) | 17 | Address before mainnet |
| 🟢 LOW (nit / polish / hygiene) | ~40 | Backlog |
| Static-tool noise | ~5 lint, 30 knip, 22 outdated deps, 2 high CVEs | |

## 🔴 HIGH (must-fix)

| # | Where | Finding |
|---|---|---|
| H1 | [firestore.rules:59-74](firestore.rules) (profile update) | **No `affectedKeys().hasOnly([...])` allowlist** — a signed-in user can `setDoc(profile, {evilField: x}, {merge: true})` and inject any field not explicitly frozen (`verified`, `xp`, `latestActivityAt`, even `lastUsernameChangeAt`). Only `groupCount` is pinned. Every future schema field inherits the gap. |
| H2 | [firestore.rules:84-100](firestore.rules) (username cooldown) | **Cooldown bypassable via H1.** On a username-preserved update, the rule never constrains `lastUsernameChangeAt`. A client can backdate it to `0` in a no-op update, then change username freely (next cooldown check sees `now - 0 ≥ 2592000000 = true`). |
| H3 | [firestore.rules:40-42](firestore.rules) | **`walletAddress` not type-checked on first set.** The append-only check accepts any value when current is null — a 1 MB string passes and freezes forever. |
| H4 | [firestore.rules:107-115](firestore.rules) (bounty settle path) | **`open → settled` doesn't check `escrowFunded == true`.** A poster could draft a bounty doc with no on-chain funding, then transition directly to `settled` with a forged `txSignature` (any string passes `is string`). On-chain there's no money to pay, but Firestore + listings + reputation are polluted. |
| H5 | [hooks/useBountyEscrow.ts:82-105](hooks/useBountyEscrow.ts) | **Ghost-escrow.** `escrowCreateBounty` runs first, then `persistBounty`. If the second write fails (App Check, rule mismatch, network), SOL is escrowed on-chain with no Firestore doc → no `contractIdHex` recoverable, no expiry sweep (CF only scans existing docs). Funds orphaned for the program's life. Already flagged in [architecture-review.md §S1](docs/architecture-review.md). |
| H6 | [functions/index.js:547-594](functions/index.js) (`deleteUserAccount`) | **Abandons on-chain escrows.** Only `open` bounties get hidden in Firestore. `in_review`/`cancelling` are untouched. Privy user is deleted in the same flow → embedded wallet keys gone. After 120 days, the `expireBounties` sweep would refund to a wallet that no longer has keys. Money lost. |
| H7 | [functions/index.js:601-605](functions/index.js) (`assertSuperAdmin`) | **Secret-as-password.** `SUPER_ADMIN_UID.value() === uid` makes the secret the auth. If it ever leaks (logs, error message, screenshot), the role is compromised — no key rotation, no MFA, no audit trail. |

## 🟡 MEDIUM (defensive miss)

| # | Where | Finding |
|---|---|---|
| M1 | [lib/services/bountyService.ts:140-141](lib/services/bountyService.ts) | **`posterWalletAddress` ≠ `posterId`.** `posterWalletAddress` comes from the function input, not derived from the auth user's profile. A client can claim someone else's wallet on the bounty doc; on-chain ix still requires the real signer (so funds-flow is safe), but Firestore-side impersonation is possible. |
| M2 | [firestore.rules:78](firestore.rules) (bountyValidShape) | **No `bountyLamports` upper bound.** `bountyLamports is int && > 0` accepts `2^63 - 1`. On-chain fails on insufficient SOL, but the doc carries an absurd value. Old gigs rule had `≤ 10000 SOL`. |
| M3 | [firestore.rules:107-115](firestore.rules) | **`submissionEndsAt > now` not enforced on create.** A poster can backdate the window so the bounty is insta-expired and refundable. Self-harm only, but enables CF-quota griefing. |
| M4 | [firestore.rules:155-167](firestore.rules) (submission create) | **No URL/length cap on `photoUrl` / `videoUrl`.** `linkUrl` is not even shape-validated at the rule level (only on the UI in `bounty/[id]/submit.tsx`). Non-UI caller can write arbitrary strings. |
| M5 | [firestore.rules:155-167](firestore.rules) | **Submission `kind` mismatch not enforced.** A modified client could submit `linkUrl` to a `photo` bounty. Low real impact (poster reviews manually), but mismatches `submissionService.ts` separation. |
| M6 | [firestore.rules:115-120](firestore.rules) | **`scope == 'public'` accepts an arbitrary `groupId` string.** Could leak into `where('groupId', 'in', …)` queries unexpectedly. |
| M7 | [firestore.rules:179-203](firestore.rules) (notifications) | **`read` flag is freely flippable both ways.** Old rule asserted `read == true` on update. Minor — no abuse vector — but a regression. |
| M8 | [functions/index.js:317-334](functions/index.js) (`decrementSubmissionCountOnDelete`) | **No floor at 0.** If `enforceSubmissionCap` is racing on delete-then-recreate, counter can drift negative. |
| M9 | [functions/index.js:570-594](functions/index.js) | **`deleteUserAccount` order matters.** Privy delete fires after Firebase delete; if Firebase delete silently fails, user can re-sign-in immediately — `ensureProfileExists` then creates a fresh profile with a new random username, but the old slug was already deleted (no collision). Soft-recovery hole. |
| M10 | [functions/index.js:227-247](functions/index.js) (`solanaRpcProxyDevnet`) | **No auth, no rate limit, CORS `*`.** Any caller can use this as a free Helius RPC. Cost vector. |
| M11 | [lib/firebase/config.ts:101-114](lib/firebase/config.ts) | **Web App Check uses literal `'RECAPTCHA_ENTERPRISE_SITE_KEY'`.** Not a real key. If web ever ships to prod without replacing this, App Check enforcement silently fails open. |
| M12 | [app/(home)/settings/profile.tsx:33](app/(home)/settings/profile.tsx) (UX) | **Username availability not eagerly checked.** "Taken" only surfaces on Save click — the TX round-trip blocks UI. `isUsernameAvailable()` exists in `profileService.ts:91` but isn't wired. |
| M13 | [contexts/UserContext.tsx:73-90](contexts/UserContext.tsx) | **`pushSyncedFor.current = user.id` is set before the async branch resolves.** If permission/token registration throws, the ref already says "synced" → no retry this session. Set after success, not before. |
| M14 | [app/(home)/bounty/[id].tsx:106](app/(home)/bounty/[id].tsx) | **`canSubmit` gates on `status === 'open'`** but the rule also accepts `in_review` for poster-settle. UI never surfaces "submission window closed" — submitters just see no button. Empty-state copy gap. |
| M15 | [functions/index.js:480-490](functions/index.js) | **Refund-reconciliation writes `txSignature: 'reconciled'`** (literal string) when on-chain account is already gone. UI `bounty/[id].tsx:286` treats `txSignature` as truthy → builds `explorerTxUrl('reconciled')` → 404. Use `null` or a UI-side guard. |
| M16 | [hooks/useBountyEscrow.ts:66](hooks/useBountyEscrow.ts) | **`posterWalletAddress` snapshotted at hook mount.** Could drift if Privy rotates the embedded wallet between mount and submit. No assertion that `posterWalletAddress === profile.walletAddress`. |
| M17 | npm audit (functions/) | **2 high-severity CVEs in transitive deps:** `bigint-buffer` (buffer overflow) via `@solana/web3.js`; `@tootallnate/once` (control-flow scoping) via firebase-admin → http-proxy-agent chain. Both have fixes available, both require breaking upgrades. |

## 🟢 LOW (nits / polish / hygiene)

| # | Where | Finding |
|---|---|---|
| L1 | [app/(home)/settings/profile.tsx:87](app/(home)/settings/profile.tsx) | `haptic('success')` diverges from project vocabulary (sprint rules: success = `heavy`). |
| L2 | [components/features/bounty/PostBountySheet.tsx:451](components/features/bounty/PostBountySheet.tsx) | `borderRadius: 9999` should use `Radius.full` per layout-constants rule. |
| L3 | [components/features/bounty/BountyItemCard.tsx:185-189](components/features/bounty/BountyItemCard.tsx) | `submissionStatusToCard` treats `refunded` as `lost` — semantically, a refund means "poster picked nobody," not "you lost." |
| L4 | [lib/types/submission.ts:9-15](lib/types/submission.ts) | `photoUrl/videoUrl` are typed `string` and default to `''`. Consumers do `!!submission.videoUrl` — works but a discriminated union on `kind` would be cleaner. |
| L5 | [contexts/AuthContext.tsx:121-123](contexts/AuthContext.tsx) | `clearPushToken` is fire-and-forget `.catch(() => null)` — swallows any rule-tightening failure silently. |
| L6 | [contexts/UserContext.tsx:111-118](contexts/UserContext.tsx) | Push-token rotation listener depends only on `user`; if `user` becomes null mid-callback the captured-by-closure id is still used. Caught & swallowed → noise only. |
| L7 | Static / 7 unguarded `console.error/warn` calls in `UserContext`, `AuthContext`, `ErrorBoundary` | Could leak error context in production. Gate behind `__DEV__` or route through a centralized logger. |
| L8 | ESLint warnings (5) | `inbox.tsx:43`, `profile.tsx:49` — `useMemo` deps from logical expression. `wallet.tsx:22` unused `Neutral`. `TabBar.tsx:31,33` unused `TAB_ORDER`, `FADE_ZONE`. All pre-existing. |
| L9 | Knip — **30 unused exports + 11 unused types + 3 stale knip.json entries** | Notable: `BountyItemCard`, `BountyStatusIcon`, `computeFeeLamports`, `computeFeeSol`, `PROTOCOL_FEE_BPS`, `isUsernameAvailable`, several `groupService.*` admin functions. Worth a sweep. |
| L10 | Knip — `expo-updates` referenced in `app.json` but not in `package.json` | Unlisted dep — either remove from app.json or add to deps. |
| L11 | Expo doctor — **Duplicate native modules** | `expo-symbols` 55.0.8 vs 55.0.5 (from `expo-router/node_modules/`); `@expo/log-box` 55.0.10 vs 55.0.7. iOS native-build risk. |
| L12 | Expo doctor — **22 outdated packages**, including major mismatches: `expo-secure-store@~15.0.0` vs expected `~55.0.13` (literally 4 SDKs old; **not used in code**, can be removed entirely), `react-native-get-random-values@^2.0.0` vs `~1.11.0`. |
| L13 | [lib/firebase/config.ts:5,107](lib/firebase/config.ts) | 2 `@ts-ignore` lines — documented (Firebase RN types, App Check debug token). Acceptable. |
| L14 | Type casts: 6 `as unknown as` / `as any` outside generated IDL | Mostly in `EagleLoader`/`ArrowProgress` (Skia color coercion), `notifications.tsx`/`_layout.tsx` (router href). Acceptable for boundary code. |
| L15 | `functions/index.js:29` | `REFUND_CALLER_KEYPAIR_BASE58 = defineSecret('VERIFIER_KEYPAIR_BASE58')` — secret name preserved for back-compat. Documented; fine. |
| L16 | IDL leftovers | `settleAutoBounty` + `submissionWindowSecs` field still present in `lib/anchor/idl.ts`, `idl-types.ts`, `functions/idl.json`. Correct — IDL is on-chain truth; we just don't call those instructions. |
| L17 | `.env.example` missing | Not a leak (`.env` is gitignored) but a contributor-onboarding gap. |
| L18 | [lib/services/bountyService.ts:107-120](lib/services/bountyService.ts) | `draftBounty` docstring says "reserves a docId"; actually just generates one client-side. Misleading. |
| L19 | [lib/services/submissionService.ts:138](lib/services/submissionService.ts) | `createLinkSubmission` doesn't validate `linkUrl` shape (UI does). Non-UI caller can pass anything. |

## 🟢 Tool snapshots (raw)

- **TypeScript:** 0 errors
- **ESLint:** 0 errors, 5 warnings (pre-existing, see L8)
- **Knip:** 30 unused exports · 11 unused types · 1 unlisted dep · 3 stale config hints
- **Functions tests:** 0 tests, 0 suites — no test files in `functions/`
- **Anchor build:** clean (only deprecated `realloc` warning from upstream)
- **Firestore rules:** compile + dry-run clean
- **npm audit (functions/):** 11 vulns (9 low, 2 high) — fixes require breaking upgrades on `firebase-admin` + `@solana/web3.js`
- **Expo doctor:** 2 of 18 checks failed (duplicate native deps + outdated packages)

## Recommended fix order (sprint-pragmatic)

1. **H4 + H1** — biggest exploit surface, ~30min in `firestore.rules`. Add `affectedKeys().hasOnly([...])` to the profile update; gate bounty settle on `resource.data.escrowFunded == true`.
2. **H5 (ghost-escrow)** — flip order in `useBountyEscrow.post`: write Firestore doc with `escrowFunded: false` first, then on-chain create, then update `escrowFunded: true`. ~30min.
3. **H3 (walletAddress type-check)** + **H2 (cooldown coupling)** — fix together with H1's allowlist; both collapse once `lastUsernameChangeAt` is in the freeze set.
4. **H7 (super-admin)** — replace secret-as-password with custom-claims (`admin.auth().setCustomUserClaims(uid, {superAdmin: true})`) + `request.auth.token.superAdmin == true` rule. ~45min.
5. **H6 (account deletion)** — pre-flight refund-or-warn for any non-terminal bounty before tearing down the wallet.
6. **M11 (App Check placeholder)** — single line replacement, but only matters when web ships.
7. **M10 (RPC proxy)** — add token / simple HMAC or per-IP rate limit.
8. **L9 / L10 / L11 / L12** — dependency hygiene pass: drop `expo-secure-store`, run `npx expo install --check`, dedupe with pnpm overrides.

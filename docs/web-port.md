# Adler — Web Port Specification

A complete spec for porting the Adler iOS/Android app (Expo + React Native) to the web (Next.js App Router). The mobile app and the web app share **the same Privy app, the same Firebase project (`emptea-adler`), and the same Solana wallet per user** — a user signing in on web sees their existing balance, listings, orders, and saved items.

The framework is different. Everything else — design tokens, copy, data shapes, security rules, payment flow, business logic — is identical. When in doubt, mirror the iOS app.

---

## Table of Contents

1. [Product overview](#1-product-overview)
2. [Tech stack (web)](#2-tech-stack-web)
3. [Environment variables](#3-environment-variables)
4. [Authentication: Privy ↔ Firebase bridge](#4-authentication-privy--firebase-bridge)
5. [Solana payment layer](#5-solana-payment-layer)
6. [Data model (Firestore)](#6-data-model-firestore)
7. [Firestore security rules](#7-firestore-security-rules)
8. [Storage rules + media upload contract](#8-storage-rules--media-upload-contract)
9. [Cloud Functions](#9-cloud-functions)
10. [Information architecture & routes](#10-information-architecture--routes)
11. [Screen specs](#11-screen-specs)
12. [Design system: tokens](#12-design-system-tokens)
13. [Design system: components](#13-design-system-components)
14. [State management](#14-state-management)
15. [TanStack Query keys](#15-tanstack-query-keys)
16. [UX principles (12 rules)](#16-ux-principles-12-rules)
17. [Copy strings (empty states + auth)](#17-copy-strings)
18. [Categories](#18-categories)
19. [Order state machine](#19-order-state-machine)
20. [Saves (bookmarks)](#20-saves-bookmarks)
21. [Profiles, usernames, reservations](#21-profiles-usernames-reservations)
22. [Push notifications](#22-push-notifications)
23. [Account deletion](#23-account-deletion)
24. [Web-specific deviations](#24-web-specific-deviations)
25. [Pre-launch checklist](#25-pre-launch-checklist)

---

## 1. Product overview

**Adler** is a two-sided UGC marketplace.

- **Creators** sell **packages** (pre-built content offerings, fixed price in SOL) and **apply** to brand gigs.
- **Brands** **buy** packages and **post gigs** that creators apply to.
- All payments settle as **direct SOL transfers on Solana** (currently devnet) from the buyer's embedded Privy wallet to the seller's embedded wallet.
- There is **no escrow, no platform fee, no fiat rail** in v1.
- After a sale, both sides can rate each other once the order reaches `complete`.

The user picks one role on first sign-in and can switch later in Settings (the wallet, listings, and history persist across role switches).

**Time-to-value target:** sign in → role-select → Browse in **under 60 seconds**.

**Design philosophy:** *industrial precision*. High-contrast, data-forward, zero visual noise. Stripe Dashboard density meets a cockpit gauge cluster.

---

## 2. Tech stack (web)

| Concern | Choice |
|---|---|
| Framework | **Next.js 15 (App Router)** + React 19 + TypeScript (strict) |
| Styling | **Tailwind CSS** + **shadcn/ui** baseline |
| Class merger | `clsx` + `tailwind-merge` exposed as `cn()` |
| Server state | **TanStack Query 5** |
| Global state | React Context (Auth, User, Theme, OverlaySheets) |
| Auth | **`@privy-io/react-auth`** (web SDK) → custom Cloud Function → Firebase Auth |
| Payments | `@solana/web3.js` against Solana **devnet** (configurable via env), routed through the existing `solanaRpcProxy` Cloud Function in production |
| Wallet | Privy embedded Solana wallet (created on first login, same address mobile + web) |
| Backend | Firebase (Firestore + Storage + Functions) — **same `emptea-adler` project as mobile** |
| Analytics / crash | Sentry web SDK (optional; controlled via env) |
| Fonts | **Geist Regular (400)** + **Geist SemiBold (600)** via `next/font` |
| Icons | `lucide-react` |
| Animation | Framer Motion (sheet/modal transitions, button micro-interactions) |
| QR codes | `qrcode.react` (for the wallet Receive flow) |

Notes:
- Do **not** use the Firebase Admin SDK in the browser. Only Cloud Functions touch Admin.
- React Native packages used in the mobile app (`react-native-*`, `expo-*`, `@shopify/react-native-skia`, `nativewind`) are **not used on web**. Reimplement the visuals with HTML/CSS/SVG.

---

## 3. Environment variables

Mobile uses `EXPO_PUBLIC_*`. On web, use `NEXT_PUBLIC_*` for the **same values** (same Firebase project, same Privy app, same Solana RPC proxy).

```env
# Firebase — emptea-adler (shared with mobile)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAvtLG_1PF2tE2jEVnkXG4AjyY9SuwDzTM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=emptea-adler.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=emptea-adler
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=emptea-adler.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=520618246879
NEXT_PUBLIC_FIREBASE_APP_ID=1:520618246879:web:408c335b2156abccd31f6a
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-ZTFCWNGHH6

# Privy (Adler app — shared with mobile)
NEXT_PUBLIC_PRIVY_APP_ID=cmomnlm4h00ac0ci5n3nykidx
NEXT_PUBLIC_PRIVY_CLIENT_ID=client-WY6YgLEtUovoiv7JfrT23eHf2NnC3o3fPFoEudu1MAQa7

# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
# Production: point at the deployed Cloud Function so the Helius API key never ships in the bundle
NEXT_PUBLIC_SOLANA_RPC_PROXY_URL=https://us-central1-emptea-adler.cloudfunctions.net/solanaRpcProxy
# Dev fallback (omit in prod)
# NEXT_PUBLIC_SOLANA_RPC_URL=

# Firebase App Check (production only; uses reCAPTCHA Enterprise on web)
NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY=

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=
```

**Resolution rules** (mirror `lib/constants/featureGates.ts`):
- `SOLANA_NETWORK` defaults to `devnet` and must be one of `devnet | mainnet-beta | testnet`.
- `SOLANA_RPC_URL` resolves to (in order): `NEXT_PUBLIC_SOLANA_RPC_PROXY_URL` → `NEXT_PUBLIC_SOLANA_RPC_URL` → public Solana RPC for the selected network.
- `SOLANA_EXPLORER_BASE = 'https://explorer.solana.com'`.

```ts
// lib/constants/featureGates.ts (web)
export type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet';
const ALLOWED: readonly SolanaNetwork[] = ['devnet', 'mainnet-beta', 'testnet'];
const RAW = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet').toLowerCase();
export const SOLANA_NETWORK: SolanaNetwork = (ALLOWED as readonly string[]).includes(RAW)
  ? (RAW as SolanaNetwork)
  : 'devnet';
const DEFAULT: Record<SolanaNetwork, string> = {
  'devnet': 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  'testnet': 'https://api.testnet.solana.com',
};
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_PROXY_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  DEFAULT[SOLANA_NETWORK];
export const SOLANA_EXPLORER_BASE = 'https://explorer.solana.com';
```

---

## 4. Authentication: Privy ↔ Firebase bridge

The bridge already exists as a Cloud Function — **do not re-implement, reuse it from web.**

### Flow (identical to mobile)

1. User signs in via Privy on the web (`useLoginWithOAuth` from `@privy-io/react-auth`, Apple + Google).
2. Privy issues a JWT (the access token). Get it via `usePrivy().getAccessToken()`.
3. Web calls the existing **`mintFirebaseToken`** callable Cloud Function with `{ accessToken }`.
4. The Function verifies the token against Privy's JWKS and returns a Firebase **custom token** with `uid = privy.userId` (e.g. `did:privy:abc…`).
5. Web calls `signInWithCustomToken(auth, customToken)` — the resulting Firebase auth `uid` matches the Privy user id, so all Firestore rules using `request.auth.uid == <userId>` keep working.
6. On Privy logout, also `signOut(auth)`.

### Provider tree (root layout)

```
ErrorBoundary
  PrivyProvider
    QueryProvider                      // TanStack Query
      ThemeProvider
        AuthProvider                   // bridges Privy → Firebase
          OfflineBanner
          UserProvider                 // ensures profile, loads role
            <children>
            ToastManager
            OverlaySheetsProvider      // mounts global Create / Wallet / RoleSwitch sheets
```

### `PrivyProvider` configuration

```tsx
<PrivyProvider
  appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
  clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID}
  config={{
    embeddedWallets: {
      solana: { createOnLogin: 'users-without-wallets' },
    },
    loginMethods: ['apple', 'google'],
  }}
>
  ...
</PrivyProvider>
```

### Bridge service (web)

```ts
// lib/services/privyAuthService.ts
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, signOut as fbSignOut } from 'firebase/auth';
import { auth, functions } from '@/lib/firebase/config';

const mintFirebaseTokenFn = httpsCallable<
  { accessToken: string },
  { token: string; uid: string }
>(functions, 'mintFirebaseToken');

const deleteUserAccountFn = httpsCallable<Record<string, never>, { ok: boolean }>(
  functions,
  'deleteUserAccount',
);

export async function bridgeToFirebase(privyAccessToken: string): Promise<string> {
  const result = await mintFirebaseTokenFn({ accessToken: privyAccessToken });
  if (!result.data?.token) throw new Error('mintFirebaseToken returned no token');
  await signInWithCustomToken(auth, result.data.token);
  return result.data.uid;
}

export async function signOutOfFirebase() {
  if (auth.currentUser) await fbSignOut(auth);
}

export async function deleteAccount() {
  await deleteUserAccountFn({});
}
```

### `AuthProvider` rules (mirror `contexts/AuthContext.tsx`)

- Listen to `onAuthStateChanged` for the canonical Firebase user (the source of truth — `userId === Privy user id`).
- Watch `usePrivy().user?.id`. When it changes:
  - If null → call `signOutOfFirebase()`.
  - Else → fetch Privy access token, call `bridgeToFirebase(token)`. Cache the last bridged Privy id in a ref to avoid double-bridging on Privy re-renders.
  - On bridge failure: toast "Sign-in failed. Please try again.", `privyLogout()` → `signOutOfFirebase()` as fallback so the user lands on sign-in instead of a stuck loader.
- Expose:
  - `user: { id, email } | null` (Firebase user)
  - `privyUserId: string | null`
  - `walletAddress: string | null` (from `useEmbeddedSolanaWallet().wallets[0].address`)
  - `isReady: boolean` (Privy ready)
  - `isBridging: boolean`
  - `isConnected: boolean` (debounce 300ms via `navigator.onLine` + `window.addEventListener('online'|'offline')`)
  - `signOut(): Promise<void>` → `privyLogout()` → `signOutOfFirebase()` → `queryClient.clear()`
  - `runIfOnline(fn)` → executes `fn` only if online, else toasts "You are offline. This action is disabled."

---

## 5. Solana payment layer

Mirror **exactly** what `lib/solana/connection.ts`, `lib/solana/transferSol.ts`, `hooks/useSolanaPayment.ts`, and `lib/services/paymentService.ts` do today.

### Connection singleton

```ts
// lib/solana/connection.ts
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SOLANA_RPC_URL, SOLANA_EXPLORER_BASE, SOLANA_NETWORK } from '@/lib/constants/featureGates';

let connection: Connection | null = null;
export function getConnection(): Connection {
  if (!connection) connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  return connection;
}
export const solToLamports = (sol: number) => Math.round(sol * LAMPORTS_PER_SOL);
export const lamportsToSol = (lamports: number) => lamports / LAMPORTS_PER_SOL;
export const explorerTxUrl = (sig: string) =>
  `${SOLANA_EXPLORER_BASE}/tx/${sig}?cluster=${SOLANA_NETWORK}`;
export const explorerAddressUrl = (addr: string) =>
  `${SOLANA_EXPLORER_BASE}/address/${addr}?cluster=${SOLANA_NETWORK}`;
```

### Transfer (build, sign, send via Privy embedded wallet)

```ts
// lib/solana/transferSol.ts
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { getConnection, solToLamports } from './connection';

export interface TransferSolInput {
  /** Privy embedded Solana wallet provider — `wallet.getProvider()` from the web SDK. */
  provider: {
    request: (args: {
      method: 'signAndSendTransaction';
      params: { transaction: Transaction; connection: ReturnType<typeof getConnection> };
    }) => Promise<{ signature: string }>;
  };
  fromAddress: string;
  toAddress: string;
  amountSol: number;
}

export async function transferSol({
  provider, fromAddress, toAddress, amountSol,
}: TransferSolInput): Promise<string> {
  if (!toAddress) throw new Error('Recipient wallet address is missing');
  if (amountSol <= 0) throw new Error('Amount must be positive');

  const connection = getConnection();
  const fromPubkey = new PublicKey(fromAddress);
  const toPubkey = new PublicKey(toAddress);
  const lamports = solToLamports(amountSol);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const tx = new Transaction({ feePayer: fromPubkey, blockhash, lastValidBlockHeight })
    .add(SystemProgram.transfer({ fromPubkey, toPubkey, lamports }));

  const result = await provider.request({
    method: 'signAndSendTransaction',
    params: { transaction: tx, connection },
  });
  return result.signature;
}
```

### `payForListing` orchestration (verbatim port)

```ts
// lib/services/paymentService.ts
const FEE_BUFFER_SOL = 0.0001;
const FEE_BUFFER_LAMPORTS = solToLamports(FEE_BUFFER_SOL);

export async function payForListing(input: {
  type: 'package' | 'gig';
  referenceId: string;
  sellerId: string;
  amountSol: number;
  buyerWalletAddress: string;
  walletProvider: ProviderType;          // from useSolanaWallets()[0].getProvider()
}): Promise<{ orderId: string; signature: string }> {
  // 1. Resolve seller wallet
  const seller = await getProfile(input.sellerId);
  if (!seller?.walletAddress) throw new Error('Seller has no Solana wallet address. Cannot send payment.');

  // 2. Preflight balance check (best-effort — surfaces a nicer error)
  try {
    const balance = await getConnection().getBalance(new PublicKey(input.buyerWalletAddress));
    const required = solToLamports(input.amountSol) + FEE_BUFFER_LAMPORTS;
    if (balance < required) {
      throw new Error(
        `Insufficient SOL — your balance is ${formatSol(lamportsToSol(balance))}, ` +
        `you need at least ${formatSol(input.amountSol + FEE_BUFFER_SOL)} ` +
        `(includes ~${formatSol(FEE_BUFFER_SOL)} for fees).`
      );
    }
  } catch (err: any) {
    if (err?.message?.startsWith('Insufficient SOL')) throw err;
    // Swallow other RPC errors so the actual transfer can surface its real reason.
  }

  // 3. Create pending order BEFORE sending (intent record)
  const orderId = await createPendingOrder({
    type: input.type,
    referenceId: input.referenceId,
    sellerId: input.sellerId,
    amountSol: input.amountSol,
  });

  // 4. Sign + send
  let signature: string;
  try {
    signature = await transferSol({
      provider: input.walletProvider,
      fromAddress: input.buyerWalletAddress,
      toAddress: seller.walletAddress,
      amountSol: input.amountSol,
    });
  } catch (err) {
    await markOrderStatus(orderId, 'failed').catch(() => {});  // don't pollute inbox
    throw err;
  }

  // 5. Mark paid with signature
  await markOrderPaid(orderId, signature);
  return { orderId, signature };
}
```

### `useSolanaPayment` hook

```ts
import { useSolanaWallets } from '@privy-io/react-auth/solana'; // verify exact path with Privy web docs
import { payForListing } from '@/lib/services/paymentService';

export function useSolanaPayment() {
  const { wallets } = useSolanaWallets();
  const wallet = wallets?.[0];

  const pay = async (args: {
    type: 'package' | 'gig'; referenceId: string; sellerId: string; amountSol: number;
  }) => {
    if (!wallet) throw new Error('No embedded Solana wallet available');
    const provider = await wallet.getProvider();
    return payForListing({ ...args, buyerWalletAddress: wallet.address, walletProvider: provider });
  };

  return { pay, walletAddress: wallet?.address ?? null, ready: !!wallet };
}
```

### Devnet warning

Whenever a transfer is about to happen, surface a one-line caption next to the amount:
- Devnet: `"Devnet · this is test SOL, not real funds"` in `ACCENT_COLORS.pink` (`#ff0088`).
- Other networks: `"<network> · real SOL transfer"` in muted text.

### Funding test SOL on devnet

Show this hint on the Wallet screen and in the Receive sheet:
```
solana airdrop 1 <walletAddress> --url devnet
```

---

## 6. Data model (Firestore)

Collections live in the **`(default)` database in region `eur3`**. Document ids are auto-generated by Firestore unless noted otherwise.

```ts
// types/marketplace.ts — copy verbatim into the web codebase

export type UserRole = 'creator' | 'brand';

export interface Profile {
  id: string;                          // Firestore doc id == Firebase auth uid == Privy user id
  role: UserRole | null;               // null until role-select completes
  username: string;                    // ^[a-z0-9_]{3,20}$
  displayName: string;                 // 1–50 chars
  bio: string;                         // 0–280 chars
  avatarUrl: string | null;
  walletAddress: string | null;        // append-only once set (rule-enforced)
  pushToken: string | null;            // Expo push token; web can leave null
  createdAt: number;                   // millis
  updatedAt: number;
}

export type PackageStatus = 'active' | 'paused' | 'sold';

export interface PackageListing {
  id: string;
  sellerId: string;                    // Profile.id
  title: string;                       // 1–80 chars
  description: string;                 // 1–1000 chars
  priceSol: number;                    // > 0 and ≤ 10000
  deliverables: string[];              // free-form bullets, currently unused in v1 forms
  coverImageUrl: string | null;
  mediaUrls: string[];                 // gallery images
  category: Category;
  status: PackageStatus;
  createdAt: number;
}

export type GigStatus = 'open' | 'awarded' | 'closed';

export interface Gig {
  id: string;
  brandId: string;                     // Profile.id
  title: string;                       // 1–80 chars
  description: string;                 // 1–1000 chars
  budgetSol: number;                   // > 0 and ≤ 10000
  deadline: number | null;             // millis; nullable
  requirements: string;                // 0–1000 chars
  category: Category;
  status: GigStatus;
  createdAt: number;
}

export type ApplicationStatus = 'pending' | 'shortlisted' | 'awarded' | 'rejected';

export interface GigApplication {
  id: string;
  gigId: string;
  creatorId: string;
  message: string;                     // 1–1000 chars
  sampleUrls: string[];                // ≤ 4 entries
  status: ApplicationStatus;
  createdAt: number;
}

export type OrderType = 'package' | 'gig';
export type OrderStatus = 'pending' | 'paid' | 'delivered' | 'complete' | 'failed';

export interface Order {
  id: string;
  type: OrderType;
  referenceId: string;                 // packageId or gigId
  buyerId: string;
  sellerId: string;                    // != buyerId
  amountSol: number;                   // > 0 and ≤ 10000
  txSignature: string | null;          // append-only once set
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Review {
  id: string;                          // deterministic: `${orderId}_${reviewerId}`
  orderId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;                      // 1–5
  comment: string;                     // 0–500 chars
  createdAt: number;
}

export type SavedKind = 'package' | 'gig';

export interface Save {
  id: string;                          // deterministic: `${userId}_${kind}_${listingId}`
  userId: string;
  kind: SavedKind;
  listingId: string;
  createdAt: number;
}

export type FeedItem =
  | { kind: 'package'; data: PackageListing }
  | { kind: 'gig'; data: Gig };
```

### Auxiliary collection: `usernames`

```ts
// usernames/{slug}        // doc id is the lowercase username
{
  userId: string;          // claimer's Profile.id
  createdAt: Timestamp;
}
```

This collection is the **uniqueness ledger** for usernames. It is publicly readable (so a client can check availability) but only writable by the claiming user. Write the slug doc inside the same Firestore transaction as the profile write, and delete the old slug when a username changes — see `ensureProfileExists` and `updateProfile` in §21.

### Indexes (`firestore.indexes.json`)

These composite indexes are already deployed. Keep them in sync if you add queries:

| Collection | Fields |
|---|---|
| `packages` | `status ASC`, `createdAt DESC` |
| `packages` | `status ASC`, `category ASC`, `createdAt DESC` |
| `packages` | `sellerId ASC`, `createdAt DESC` |
| `gigs` | `status ASC`, `createdAt DESC` |
| `gigs` | `status ASC`, `category ASC`, `createdAt DESC` |
| `gigs` | `brandId ASC`, `createdAt DESC` |
| `gigApplications` | `creatorId ASC`, `createdAt DESC` |
| `gigApplications` | `gigId ASC`, `createdAt DESC` |
| `orders` | `buyerId ASC`, `createdAt DESC` |
| `orders` | `sellerId ASC`, `createdAt DESC` |
| `orders` | `status ASC`, `createdAt ASC` |
| `saves` | `userId ASC`, `createdAt DESC` |

### Cursor pagination contract

`listActivePackagesPage` / `listOpenGigsPage` return:

```ts
{ items: T[]; nextCursor: number | null }
```

Where `nextCursor` is the `createdAt` ms of the last item, passed back as `Timestamp.fromMillis(cursor)` to `startAfter()` on the next page. `null` means "no more pages."

The Browse feed merges packages and gigs in parallel:

```ts
queryFn: async ({ pageParam }) => {
  const cursors = pageParam ?? { packagesCursor: null, gigsCursor: null };
  const [pkgPage, gigPage] = await Promise.all([
    listActivePackagesPage({ limit: 25, cursor: cursors.packagesCursor }),
    listOpenGigsPage    ({ limit: 25, cursor: cursors.gigsCursor }),
  ]);
  const items: FeedItem[] = [
    ...pkgPage.items.map((p) => ({ kind: 'package' as const, data: p })),
    ...gigPage.items.map((g) => ({ kind: 'gig' as const, data: g })),
  ];
  items.sort((a, b) => b.data.createdAt - a.data.createdAt);
  const noMore = !pkgPage.nextCursor && !gigPage.nextCursor;
  return {
    items,
    next: noMore ? null : { packagesCursor: pkgPage.nextCursor, gigsCursor: gigPage.nextCursor },
  };
}
```

---

## 7. Firestore security rules

**Do not change the rules when porting to web.** They live in `firestore.rules` at the repo root and are deployed to the shared `emptea-adler` project. Mobile and web both rely on the same rules. Reproduced here for reference; the mobile copy is canonical.

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthed() { return request.auth != null; }
    function isOwner(uid) { return isAuthed() && request.auth.uid == uid; }

    function validProfileUsername(value) { return value is string && value.matches('^[a-z0-9_]{3,20}$'); }
    function validProfileDisplayName(value) { return value is string && value.size() > 0 && value.size() <= 50; }
    function validProfileBio(value) { return value is string && value.size() <= 280; }
    function validProfileAvatarUrl(value) { return value == null || (value is string && value.size() <= 2048); }
    function validProfileRole(value) { return value == null || value in ['creator', 'brand']; }
    function validProfilePushToken(value) { return value == null || (value is string && value.size() > 0 && value.size() <= 256); }

    // saves/{saveId} — id is `${userId}_${kind}_${listingId}` (rule-enforced)
    match /saves/{saveId} {
      allow read: if isAuthed() && resource.data.userId == request.auth.uid;
      allow create: if isAuthed() &&
        request.resource.data.userId == request.auth.uid &&
        saveId == request.resource.data.userId + '_' + request.resource.data.kind + '_' + request.resource.data.listingId &&
        request.resource.data.kind in ['package', 'gig'] &&
        request.resource.data.listingId is string &&
        request.resource.data.listingId.size() > 0;
      allow update: if false;
      allow delete: if isAuthed() && resource.data.userId == request.auth.uid;
    }

    // usernames/{slug} — public read so clients can check availability
    match /usernames/{slug} {
      allow read: if true;
      allow create: if isAuthed() &&
        request.resource.data.userId == request.auth.uid &&
        slug.matches('^[a-z0-9_]{3,20}$');
      allow update: if isAuthed() && resource.data.userId == request.auth.uid;
      allow delete: if isAuthed() && resource.data.userId == request.auth.uid;
    }

    // profiles/{userId}
    match /profiles/{userId} {
      allow read: if true;
      allow create: if isOwner(userId);
      allow update: if isOwner(userId)
        && request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['username', 'displayName', 'bio', 'avatarUrl', 'role', 'walletAddress', 'pushToken', 'updatedAt'])
        && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['username'])
            || validProfileUsername(request.resource.data.username))
        && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['displayName'])
            || validProfileDisplayName(request.resource.data.displayName))
        && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['bio'])
            || validProfileBio(request.resource.data.bio))
        && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['avatarUrl'])
            || validProfileAvatarUrl(request.resource.data.avatarUrl))
        && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role'])
            || validProfileRole(request.resource.data.role))
        && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['pushToken'])
            || validProfilePushToken(request.resource.data.pushToken))
        // walletAddress is append-only: null → string, but never overwritten.
        && (resource.data.walletAddress == null
            || resource.data.walletAddress == request.resource.data.walletAddress);
      allow delete: if false;
    }

    // packages/{id}
    match /packages/{packageId} {
      allow read: if (resource == null || resource.data.status == 'active') ||
                     (isAuthed() && resource.data.sellerId == request.auth.uid);
      allow create: if isAuthed() &&
        request.resource.data.sellerId == request.auth.uid &&
        request.resource.data.status == 'active' &&
        request.resource.data.priceSol is number &&
        request.resource.data.priceSol > 0 &&
        request.resource.data.priceSol <= 10000 &&
        request.resource.data.title is string &&
        request.resource.data.title.size() > 0 &&
        request.resource.data.title.size() <= 80 &&
        request.resource.data.description is string &&
        request.resource.data.description.size() > 0 &&
        request.resource.data.description.size() <= 1000 &&
        request.resource.data.category in
          ['beauty', 'fitness', 'health', 'education', 'food', 'lifestyle', 'general'];
      allow update: if isAuthed() && resource.data.sellerId == request.auth.uid;
      allow delete: if false;
    }

    // gigs/{id}
    match /gigs/{gigId} {
      allow read: if (resource == null || resource.data.status == 'open') ||
                     (isAuthed() && resource.data.brandId == request.auth.uid);
      allow create: if isAuthed() &&
        request.resource.data.brandId == request.auth.uid &&
        request.resource.data.status == 'open' &&
        request.resource.data.budgetSol is number &&
        request.resource.data.budgetSol > 0 &&
        request.resource.data.budgetSol <= 10000 &&
        request.resource.data.title is string &&
        request.resource.data.title.size() > 0 &&
        request.resource.data.title.size() <= 80 &&
        request.resource.data.description is string &&
        request.resource.data.description.size() > 0 &&
        request.resource.data.description.size() <= 1000 &&
        request.resource.data.requirements is string &&
        request.resource.data.requirements.size() <= 1000 &&
        request.resource.data.category in
          ['beauty', 'fitness', 'health', 'education', 'food', 'lifestyle', 'general'];
      allow update: if isAuthed() && resource.data.brandId == request.auth.uid;
      allow delete: if false;
    }

    // gigApplications/{id}
    match /gigApplications/{applicationId} {
      allow read: if isAuthed() && (
        resource.data.creatorId == request.auth.uid ||
        get(/databases/$(database)/documents/gigs/$(resource.data.gigId)).data.brandId == request.auth.uid
      );
      allow create: if isAuthed() &&
        request.resource.data.creatorId == request.auth.uid &&
        request.resource.data.status == 'pending' &&
        request.resource.data.message is string &&
        request.resource.data.message.size() > 0 &&
        request.resource.data.message.size() <= 1000 &&
        request.resource.data.sampleUrls is list &&
        request.resource.data.sampleUrls.size() <= 4 &&
        request.resource.data.gigId is string;
      // Brands flip status only — they cannot rewrite creatorId/gigId/message.
      allow update: if isAuthed() &&
        get(/databases/$(database)/documents/gigs/$(resource.data.gigId)).data.brandId == request.auth.uid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']) &&
        request.resource.data.status in ['shortlisted', 'awarded', 'rejected'];
      allow delete: if false;
    }

    // orders/{id} — buyer creates; status state machine enforced
    match /orders/{orderId} {
      allow read: if isAuthed() && (
        resource.data.buyerId == request.auth.uid ||
        resource.data.sellerId == request.auth.uid
      );
      allow create: if isAuthed() &&
        request.resource.data.buyerId == request.auth.uid &&
        request.resource.data.buyerId != request.resource.data.sellerId &&
        request.resource.data.status == 'pending' &&
        request.resource.data.txSignature == null &&
        request.resource.data.amountSol is number &&
        request.resource.data.amountSol > 0 &&
        request.resource.data.amountSol <= 10000 &&
        request.resource.data.type in ['package', 'gig'];
      allow update: if isAuthed() &&
        (resource.data.buyerId == request.auth.uid || resource.data.sellerId == request.auth.uid) &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'txSignature', 'updatedAt']) &&
        // txSignature is append-only.
        (resource.data.txSignature == null || resource.data.txSignature == request.resource.data.txSignature) &&
        (
          // pending → paid: buyer claims payment + provides signature
          (resource.data.status == 'pending' &&
           request.resource.data.status == 'paid' &&
           resource.data.buyerId == request.auth.uid &&
           request.resource.data.txSignature is string &&
           request.resource.data.txSignature.size() > 0) ||
          // pending → failed: buyer aborts
          (resource.data.status == 'pending' &&
           request.resource.data.status == 'failed' &&
           resource.data.buyerId == request.auth.uid) ||
          // paid → delivered: seller marks delivered
          (resource.data.status == 'paid' &&
           request.resource.data.status == 'delivered' &&
           resource.data.sellerId == request.auth.uid) ||
          // delivered → complete: buyer confirms receipt
          (resource.data.status == 'delivered' &&
           request.resource.data.status == 'complete' &&
           resource.data.buyerId == request.auth.uid) ||
          // No-op (touching updatedAt) — status unchanged
          (resource.data.status == request.resource.data.status)
        );
      allow delete: if false;
    }

    // reviews/{id} — id is `${orderId}_${reviewerId}`; one per reviewer per order
    match /reviews/{reviewId} {
      allow read: if true;
      allow create: if isAuthed() &&
        request.resource.data.reviewerId == request.auth.uid &&
        reviewId == request.resource.data.orderId + '_' + request.auth.uid &&
        request.resource.data.reviewerId != request.resource.data.revieweeId &&
        request.resource.data.rating is number &&
        request.resource.data.rating >= 1 && request.resource.data.rating <= 5 &&
        request.resource.data.comment is string &&
        request.resource.data.comment.size() <= 500 &&
        get(/databases/$(database)/documents/orders/$(request.resource.data.orderId)).data.status == 'complete' &&
        request.auth.uid in [
          get(/databases/$(database)/documents/orders/$(request.resource.data.orderId)).data.buyerId,
          get(/databases/$(database)/documents/orders/$(request.resource.data.orderId)).data.sellerId,
        ] &&
        request.resource.data.revieweeId in [
          get(/databases/$(database)/documents/orders/$(request.resource.data.orderId)).data.buyerId,
          get(/databases/$(database)/documents/orders/$(request.resource.data.orderId)).data.sellerId,
        ];
      allow update: if isAuthed() &&
        resource.data.reviewerId == request.auth.uid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['rating', 'comment']) &&
        request.resource.data.rating is number &&
        request.resource.data.rating >= 1 && request.resource.data.rating <= 5 &&
        request.resource.data.comment is string &&
        request.resource.data.comment.size() <= 500;
      allow delete: if false;
    }
  }
}
```

---

## 8. Storage rules + media upload contract

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile avatars: anyone signed in reads; user only writes their own.
    match /profilePictures/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
        && fileName == request.auth.uid + '.jpg'
        && request.resource.contentType == 'image/jpeg'
        && request.resource.size <= 2 * 1024 * 1024;
    }

    // Marketplace media: each owner writes under their own uid prefix.
    match /packages/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.contentType.matches('image/.*')
        && request.resource.size <= 8 * 1024 * 1024;
    }
    match /gigs/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.contentType.matches('image/.*')
        && request.resource.size <= 8 * 1024 * 1024;
    }
    match /applications/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.contentType.matches('image/.*')
        && request.resource.size <= 8 * 1024 * 1024;
    }
  }
}
```

### Upload paths

| Folder | Path | Rule |
|---|---|---|
| Profile picture | `profilePictures/{uid}.jpg` | JPEG, ≤ 2 MB, single file per user |
| Package media | `packages/{uid}/{fileId}.jpg` | image/*, ≤ 8 MB per file |
| Gig media | `gigs/{uid}/{fileId}.jpg` | image/*, ≤ 8 MB per file |
| Application sample | `applications/{uid}/{fileId}.jpg` | image/*, ≤ 8 MB per file |

### Compression contract

Mobile compresses images before upload via `expo-image-manipulator`:
- **Profile picture:** resize to max 400px wide, JPEG quality 0.7.
- **Marketplace media:** resize to max 1600px wide, JPEG quality 0.7.

On web, mirror this with a Canvas-based resize before `uploadBytes`. Browsers don't preserve EXIF orientation when re-encoding via Canvas — accept that and don't try to preserve it.

```ts
// lib/services/imageUploadService.ts (web)
async function compressImage(file: File, maxDim: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.7)
  );
}

export async function uploadProfilePicture(file: File): Promise<string> {
  const uid = auth.currentUser?.uid; if (!uid) throw new Error('Not signed in');
  const blob = await compressImage(file, 400);
  const r = ref(storage, `profilePictures/${uid}.jpg`);
  await uploadBytes(r, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(r);
}

export async function uploadMarketplaceMedia(
  file: File,
  folder: 'packages' | 'gigs' | 'applications',
  fileId: string,
): Promise<string> {
  const uid = auth.currentUser?.uid; if (!uid) throw new Error('Not signed in');
  const blob = await compressImage(file, 1600);
  const r = ref(storage, `${folder}/${uid}/${fileId}.jpg`);
  await uploadBytes(r, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(r);
}

export async function deleteMarketplaceMedia(
  folder: 'packages' | 'gigs' | 'applications',
  fileId: string,
) {
  const uid = auth.currentUser?.uid; if (!uid) throw new Error('Not signed in');
  await deleteObject(ref(storage, `${folder}/${uid}/${fileId}.jpg`)).catch(() => {});
}
```

The `fileId` shape used by the mobile create flow:
- Cover: `${draftId}-cover` where `draftId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}``.
- Gallery: `${draftId}-${index}`.

Use the same shape on web so failure-recovery cleanup works identically.

### App Check (web)

In production, initialize Firebase App Check with **reCAPTCHA Enterprise**. In dev, use the debug provider. Mobile uses Apple App Attest (iOS) — that does not apply on web.

```ts
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
if (typeof window !== 'undefined') {
  if (process.env.NODE_ENV === 'production') {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY!),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    // @ts-expect-error - debug token toggle
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider('debug'),
      isTokenAutoRefreshEnabled: true,
    });
  }
}
```

Until App Check is enforced for the project, this is a no-op for backends — but registering it now means flipping enforcement is a one-step change.

---

## 9. Cloud Functions

The Functions live in the `functions/` directory of the **mobile repo** (Node 22, ESM, `firebase-functions` v6, `@privy-io/node` v0.16, `firebase-admin` v13). They are deployed to the same `emptea-adler` project. The web client calls them — **do not duplicate them**.

### Functions used by the web app

| Name | Type | Purpose | Web should call? |
|---|---|---|---|
| `mintFirebaseToken` | Callable | Privy access token → Firebase custom token | **Yes** (every sign-in) |
| `deleteUserAccount` | Callable | Archive listings, delete profile + username, revoke auth user | **Yes** (Settings → Delete account) |
| `solanaRpcProxy` | HTTP (POST, CORS) | Forwards JSON-RPC to Helius; keeps the API key server-side | **Yes** (set `NEXT_PUBLIC_SOLANA_RPC_PROXY_URL` to its URL in production) |
| `reconcilePendingOrders` | Scheduled (every 30 min) | Marks `pending` orders > 1 hour old as `failed` | n/a (server-only) |
| `cascadeApplicationsOnGigClose` | Firestore trigger | Auto-rejects pending applications when gig closes/awards | n/a (server-only) |
| `notifyApplicationReceived` | Firestore trigger | Push to brand on new application | n/a (server-only) |
| `notifyApplicationDecided` | Firestore trigger | Push to creator on shortlist/award/reject | n/a (server-only) |
| `notifyOrderStateChanged` | Firestore trigger | Push to buyer/seller on order transitions | n/a (server-only) |

The push triggers fan out to Expo's `https://exp.host/--/api/v2/push/send` — they target Expo push tokens stored on `profiles.pushToken`. **A web user who doesn't have a mobile device will simply have `pushToken: null`** and no push goes out for them; that's fine. See §22 if/when we add web push.

### Secrets (Cloud Functions — server-side only)

Stored in Cloud Secret Manager and bound to the Functions:

- `PRIVY_APP_ID` — used by `mintFirebaseToken` to verify Privy access tokens.
- `HELIUS_RPC_URL` — full Helius RPC endpoint with the API key, used by `solanaRpcProxy`.

The web client never sees these.

### `mintFirebaseToken` implementation (reference; already deployed)

```js
// functions/index.js (excerpt)
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import { verifyAccessToken } from '@privy-io/node';
import { createRemoteJWKSet } from 'jose';

const PRIVY_APP_ID = defineSecret('PRIVY_APP_ID');

let jwksCache = null, jwksCacheAppId = null;
function getJwks(appId) {
  if (jwksCache && jwksCacheAppId === appId) return jwksCache;
  jwksCacheAppId = appId;
  jwksCache = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));
  return jwksCache;
}

export const mintFirebaseToken = onCall(
  { secrets: [PRIVY_APP_ID] },
  async (request) => {
    const accessToken = request.data?.accessToken;
    if (typeof accessToken !== 'string' || accessToken.trim() === '') {
      throw new HttpsError('invalid-argument', 'accessToken is required');
    }
    const appId = PRIVY_APP_ID.value();

    let claims;
    try {
      claims = await verifyAccessToken({
        access_token: accessToken,
        app_id: appId,
        verification_key: getJwks(appId),
      });
    } catch (err) {
      throw new HttpsError('unauthenticated', 'Invalid Privy access token', { cause: err?.message });
    }

    const uid = claims.user_id;
    if (!uid) throw new HttpsError('unauthenticated', 'Privy token has no user id');

    const customToken = await admin.auth().createCustomToken(uid, {
      privyAppId: claims.app_id ?? null,
    });
    return { token: customToken, uid };
  },
);
```

### `solanaRpcProxy` (reference; already deployed)

Plain HTTPS function with CORS enabled. Client `Connection` is configured with this URL; web3.js POSTs raw JSON-RPC bodies.

```js
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
const HELIUS_RPC_URL = defineSecret('HELIUS_RPC_URL');

export const solanaRpcProxy = onRequest(
  { cors: true, secrets: [HELIUS_RPC_URL], maxInstances: 10, concurrency: 80 },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
    const upstream = HELIUS_RPC_URL.value();
    if (!upstream) { res.status(503).send('RPC endpoint not configured'); return; }
    try {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const response = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const text = await response.text();
      res.status(response.status);
      res.set('Content-Type', response.headers.get('content-type') ?? 'application/json');
      res.send(text);
    } catch (err) {
      console.error('solanaRpcProxy error', err);
      res.status(502).send('RPC upstream failure');
    }
  },
);
```

---

## 10. Information architecture & routes

Web uses Next.js App Router. The route map mirrors the mobile app one-for-one. Names in `()` are route groups (no URL segment); they exist to share layouts.

```
app/
├── (auth)/
│   ├── layout.tsx                    // routes guard: redirect to /(home) if signed in + has role
│   ├── sign-in/page.tsx              // OAuth (Apple / Google)
│   ├── intro/page.tsx                // 3-slide onboarding (only first time; persisted via localStorage)
│   └── role-select/page.tsx          // pick Creator vs Brand
├── (home)/
│   ├── layout.tsx                    // routes guard: redirect to /(auth) if not signed-in or roleless
│   ├── (tabs)/                       // shared tab-shell layout
│   │   ├── layout.tsx                // sticky AdlerTabBar
│   │   ├── browse/page.tsx           // landing tab — mixed packages + gigs feed with filters
│   │   ├── saved/page.tsx            // bookmarked listings
│   │   ├── inbox/page.tsx            // creator: Sales / Applications · brand: Purchases / Posted / Applications
│   │   └── profile/page.tsx          // own profile dashboard
│   ├── package/[id]/page.tsx         // package detail
│   ├── gig/[id]/page.tsx             // gig detail (+ application list when brand owns it)
│   ├── order/[id]/page.tsx           // order receipt
│   ├── profile/[id]/page.tsx         // public profile (read-only)
│   ├── checkout/page.tsx             // payment confirmation
│   └── settings/
│       ├── layout.tsx
│       ├── page.tsx                  // settings index
│       ├── wallet/page.tsx
│       ├── appearance/page.tsx
│       └── about/page.tsx
└── layout.tsx                        // root: providers stack, fonts, global CSS
```

### Routing logic (mirror `app/index.tsx`)

```ts
// On the root '/' path:
//   No Privy user                          → /sign-in
//   User, no role, intro NOT seen          → /intro
//   User, no role                          → /role-select
//   User with role                          → /browse
```

Route group guards:

- **`(auth)/layout.tsx`** — if user has a role, redirect to `/browse`. If user but no role, redirect to `/role-select` (unless we are already on it).
- **`(home)/layout.tsx`** — if no user, redirect to `/sign-in`. If no role, redirect to `/role-select`.

### Tabs: 4 visible, custom tab bar

The mobile app has 5 visual slots — Browse, Saved, **Create (oversized center button, opens a sheet)**, Inbox, Profile. The center "Create" is **not a route** — it opens the global Create sheet via the OverlaySheets context.

On web:
- Render the same 5-slot layout in a sticky bottom bar **on viewports < 768px**.
- On desktop (≥ 768px), use a **persistent left sidebar** with the same 4 navigable items (Browse, Saved, Inbox, Profile) and a prominent "Create" button at the top of the sidebar that opens the same modal.

The Create sheet on mobile is a bottom sheet; on desktop, render it as a centered modal at ~600px wide.

### Detail screens use a back button, not browser-back

`ScreenHeader` shows a chevron-left back button that calls `router.back()`. On web, mirror this with the same button that calls `router.back()` — but also support the browser back button (which it does for free with App Router).

### Modal / drawer pattern on web

Mobile uses **bottom sheets** for: Create, Wallet, Send, Receive, Apply, Award confirm, Edit profile, Manage listing, Sign out, Delete account, Role switch, Review.

On web, render these as:
- **Mobile (< 768px):** bottom drawer that slides up.
- **Desktop (≥ 768px):** centered modal dialog (use shadcn/ui's `Dialog` with `Drawer` fallback at small widths).

---

## 11. Screen specs

### `/sign-in`

- Hero: centered Adler eagle logo (~171px tall). Below: `h2` "Adler" and a `body-md` tagline "Trade content." in muted text.
- Background: bottom **pink radial halo** — center `#ff0088` fading to transparent. SVG, anchored below the visible bounds so only the upper arc bleeds in. (See `app/(auth)/sign-in.tsx` for the exact gradient stops: `[0.0=#ff0088 1.0, 0.35=#ff40a6 0.7, 0.65=#ff80c4 0.35, 1.0=#ffffff 0]`, viewBox `0 0 393 280`, ellipse cx=196 cy=460 rx=260 ry=360.)
- Two CTAs stacked at the bottom (44px tall, 12px gap):
  1. **Sign in with Apple** — solid black (`theme[950]` bg, `theme[50]` text).
  2. **Sign in with Google** — outlined (`theme[50]` bg with 1px `theme[300]` border, `theme[950]` text).
- Below: legal disclaimer in `body-xs`/`theme[500]`: `"By continuing you accept our Terms of Service and Privacy Policy."` with both phrases linked. URLs:
  - ToS: `https://emptea.xyz/terms-of-service`
  - Privacy: `https://emptea.xyz/privacy-policy`

### `/intro`

3 horizontally-paged slides (one-time only; persists `onboarding_seen=true` in `localStorage`). After the last, navigate to `/role-select`.

```ts
const SLIDES = [
  { id: 'welcome', title: 'Welcome to Adler', description:
    'A two-sided marketplace where creators sell content packages and brands post gigs. Settled directly on Solana.' },
  { id: 'wallet',  title: 'Your wallet, ready to go', description:
    'Adler creates an embedded Solana wallet for you on first sign-in. You hold the keys; we just route payments.' },
  { id: 'devnet',  title: 'Test SOL, no real funds', description:
    'Adler runs on devnet during the beta. Top up free test SOL via the Solana CLI from the Wallet screen any time.' },
];
```

Each slide: centered eagle logo (140px), `h2` title centered, `body-md` description centered in `theme[500]`. Pagination dots below (active dot stretches to 18×6, inactive 6×6). "Skip" link top-right (except on last slide). Bottom CTA: "Next" (or "Get started" on last).

### `/role-select`

- `h2` "Pick your role" + subtitle in `theme[500]` — "You can switch later in Settings."
- Two `RoleSelectCard`s stacked vertically, 16px gap:
  - "I'm a creator" — "Sell content packages and apply to brand gigs."
  - "I'm a brand" — "Buy packages and post gigs for creators to apply to."
- Bottom: full-width primary button "Continue" (disabled until a card is selected).
- On confirm: `setRole(uid, role)` then `refreshProfile()` then redirect to `/browse`.

### `/browse` (home tab)

- **Header (`AdlerHomeHeader`)**: tab title on the left ("Marketplace"), live wallet balance pill on the right (tap → opens Wallet sheet).
- **Search input** below the header — placeholder "Search packages and gigs", debounced 250ms, case-insensitive substring match against `title + description`.
- **Filter chips row**: 3 chips with active states pulling from `BrowseFilters`:
  - Sort by (date / price ASC / price DESC) — opens `SortBySheet`.
  - Category — opens `CategorySheet`.
  - Price range (any / under 0.1 SOL / 0.1–1 SOL / over 1 SOL) — opens `PriceRangeSheet`.
- **Feed**: `useInfiniteQuery` on `FEED_KEYS.browse()`. Each page fetches 25 packages + 25 gigs in parallel, merges them, sorts by `createdAt DESC`. Pull-to-refresh on mobile, button or scroll-trigger on desktop. Infinite scroll trigger at 40% from the bottom.
- **Empty state**:
  - No filter applied + no data: `EMPTY_BROWSE` — "Quiet on the wire" / "When creators ship packages and brands post gigs, they land here."
  - Filter applied with no matches: `EMPTY_BROWSE_SEARCH` — "No matches" / "Try a broader term, clear a filter, or pull to refresh."

### `/saved` (home tab)

- Header: "Saved".
- Grid of `ListingCard`s for every save. `useSaves()` returns the bookmark list; for each save, fetch the underlying listing via `useQueries`. Cards that fail to resolve (deleted / paused listing) are silently dropped from the list.
- Empty state: `EMPTY_SAVED` — "Nothing saved yet" / "Bookmark a package or gig from Browse and it lands here."

### `/inbox` (home tab)

Header: "Activity". Underneath, a `UnderlineTabBar` of role-specific tabs:

- **Creator:** `Sales`, `Applications`.
- **Brand:** `Purchases`, `Posted`, `Applications`.

Each tab renders a flat list of `InboxRow` items (title + subline + `→` → opens detail). Subtitles use `formatRelative(createdAt)`.

- **Sales (creator):** orders where `sellerId == me`.
- **Applications (creator):** applications I've submitted.
- **Purchases (brand):** orders where `buyerId == me`.
- **Posted (brand):** my gigs.
- **Applications (brand):** applications across all my gigs (`listApplicationsForGigIds(gigIds)` in chunks of 30 because Firestore `in` caps at 30).

Empty states per tab use `EMPTY_INBOX_*` from `lib/utils/copy.ts`.

### `/profile` (home tab — own profile)

- `ProfileHeader` (TikTok-style centered identity):
  - Top corners: ⚙ settings icon left, wallet pill right.
  - Avatar (88×88, circular) + display name (`body-2xl-semibold`) + `@username` (`body-sm`/`theme[500]`).
  - Role pill (`Pill intent="dark"` showing "Creator" or "Brand") if set.
  - Bio in `body-sm`/`theme[700]` if set.
  - Stats line (`body-xs`/`theme[500]`): `"{n} listing(s) · Joined {Mon YYYY}"`.
  - "Edit profile" button (rounded-full, `theme[100]` bg) opens `EditProfileSheet`.
- Section: **Your packages** (creator) or **Your gigs** (brand).
  - First 6 listings as `ListingCard`s.
  - Empty: `EMPTY_PACKAGES_BY_SELLER` / `EMPTY_GIGS_BY_BRAND` + a `Button variant="secondary"` "List a package" / "Post a gig" that opens the Create sheet.

### `/profile/[id]` (public profile)

If `id === currentUserId`, redirect to `/profile`. Otherwise:

- Centered avatar + identity block (no edit affordance).
- Role pill, bio, stats line (`{n} package(s)/gig(s) · Joined {Mon YYYY}`).
- Listings section showing all of their published listings (no "Edit" controls).

### `/package/[id]`

Body sections:
1. **Hero**: full-bleed horizontal-snap gallery if `mediaUrls.length > 0`, height 280px. If empty, no hero.
2. **KPI block**: `KPI` (`md` size) showing the price + status pill + kind pill.
   - Status pill intents: `active → cyan`, `sold → lime`, `paused → neutral`.
   - Kind pill: `Package` with `pink` intent.
3. **Title** (`h4`, max 3 lines).
4. **About** card: `SectionLabel "About"` + description.
5. **Deliverables** card (only if `deliverables.length > 0`): bulleted list.
6. **Seller** card: tappable, navigates to `/profile/{sellerId}`. Shows display name + @username.

Bottom CTA (`CtaFooter`):
- If I'm not the seller AND `status === 'active'` AND seller has a wallet → "Buy for {N} SOL" → navigates to `/checkout?type=package&referenceId={id}&sellerId={sellerId}&amountSol={priceSol}&title={title}`.
- If I'm the seller → muted note "You are the seller of this package." (no buy button).
- If seller has no wallet → muted note "This seller hasn't set up a wallet yet, so payment is unavailable." (no buy button).

If I'm the seller, show `MoreHorizontal` icon in the header → opens `ManageListingSheet` (Pause/Resume, Mark sold, Re-list).

### `/gig/[id]`

Body sections:
1. **KPI block**: budget + gig status pill (`open → cyan`, `awarded → lime`, `closed → neutral`) + kind pill (`pink` intent, label "Gig").
2. **Title** (`h4`).
3. **Brief** card: description.
4. **Requirements** card (if non-empty).
5. **Brand** card: tappable, navigates to `/profile/{brandId}`.

If I'm a creator AND not the gig owner AND `status === 'open'` → bottom CTA "Apply to gig" → opens `ApplySheet`.
If I'm the brand AND it's my gig → header `MoreHorizontal` → `ManageListingSheet` (Close / Re-open). Plus a section below the brand card: **Applications · {n}** with each `ApplicationCard`:
- Tappable display name + @username row → opens that creator's public profile.
- Application status pill (`pending → neutral`, `shortlisted → cyan`, `awarded → lime`).
- Message preview (4 lines).
- If status `pending` → button "Award {budget} SOL" (disabled while another award is in flight or if gig is no longer open).

### `/checkout` (modal route)

Single-purpose payment screen. **One action per screen.** Search params:
- `type=package|gig`
- `referenceId` (package or gig id)
- `sellerId`
- `amountSol`
- `title`

Body:
1. **Big amount KPI** (`KPI size="lg"`) + caption underneath:
   - Devnet: `"Devnet · this is test SOL, not real funds"` in `ACCENT_COLORS.pink`.
   - Other: `"<network> · real SOL transfer"` in `theme[500]`.
2. **Item card** (`theme[100]` bg): `SectionLabel "Item"` + listing title.
3. **From card**: `SectionLabel "From"` + `0xABCD…WXYZ` (truncated wallet address) + caption "Your embedded wallet".

Bottom (`CtaFooter`):
- Primary button "Pay {N} SOL" (text shows "Sending…" while pending). Helper text: `"Tapping Pay sends a Solana transfer from your embedded wallet."`.
- If wallet not ready: spinner + "Waiting for wallet…".

On confirm:
1. `haptic('medium')` on tap.
2. Call `useSolanaPayment().pay({ type, referenceId, sellerId, amountSol })`.
3. Invalidate `ORDER_KEYS.asBuyer(uid)`.
4. `haptic('heavy')` + toast `"Payment sent · {sig.slice(0,8)}…"`.
5. Replace navigation to `/inbox`.

On error: toast the error, keep on screen for retry.

### `/order/[id]`

Body sections:
1. **Status pills** + kind pill. Status colors:
   - `paid`/`complete → lime`
   - `delivered → cyan`
   - `failed → orange`
   - `pending → neutral`
2. **KPI** showing `amountSol`.
3. **Buyer / Seller / Reference** card. Buyer + Seller are tappable → navigate to `/profile/{id}`.
4. **Tx signature** card (tappable when present → opens Solana Explorer at `explorerTxUrl(sig)`). When `null`: muted "Waiting for on-chain confirmation…".
5. **Reviews** card (only when `status === 'complete'`):
   - "Your review" — 5 stars + comment, if I've already left one.
   - "{counterparty}'s review" — same shape, if they've left one.
   - "No reviews yet." otherwise.

Bottom CTAs (only when actionable):
- Seller, `status='paid'` → "Mark as delivered" (transitions to `delivered`).
- Buyer, `status='delivered'` → "Confirm receipt" (transitions to `complete`).
- Either side with no review yet, `status='complete'` → "Leave a review" → opens `ReviewSheet`.
- Always: "View on Solana Explorer" (secondary, when a tx signature is present).

### `/settings`

Section list (rows are `Card variant="border-bottom"`).

| Section | Row | Trailing | Action |
|---|---|---|---|
| Account | Wallet | chevron | `/settings/wallet` |
| Account | Switch role | none | open `RoleSwitchSheet` |
| Preferences | Appearance | chevron | `/settings/appearance` |
| Help | Contact support | external | `mailto:support@emptea.xyz?subject=Adler%20support` |
| Legal | Terms of Service | external | `https://emptea.xyz/terms-of-service` |
| Legal | Privacy Policy | external | `https://emptea.xyz/privacy-policy` |
| About | About Adler | chevron | `/settings/about` |
| Session | **Sign out** *(destructive)* | none | open `SignOutSheet` |
| Session | **Delete account** *(destructive)* | none | open `DeleteAccountSheet` |

Destructive items render label + icon in `#DC143C`.

### `/settings/wallet`

- **Balance card**: `SectionLabel "Balance · Devnet"` + `KPI` of current balance + Refresh affordance (icon + "Refresh"). When balance is exactly 0, show `EMPTY_WALLET_BALANCE.description`.
- **Address card**: `SectionLabel "Address"` + full base58 address + two affordances ("Copy" + "Explorer").
- Footer note (devnet only): `"On devnet, fund your wallet with the Solana CLI: solana airdrop 1 {address} --url devnet"` (the command rendered in semibold for emphasis).

### `/settings/appearance`

3 rows (theme: System / Light / Dark) — mirror `app/(home)/settings/appearance.tsx`. Each row shows label + description. Selected row shows a `Check` icon on the right.

### `/settings/about`

Read-only:
- `SectionLabel "App"` + Version row + Build row (from your build process — Next.js doesn't have `expo-application`, so source the version from `package.json` or `process.env.NEXT_PUBLIC_APP_VERSION` at build).
- Tagline: `"Adler is a two-sided UGC marketplace settled on Solana. Built by emptea."`

---

## 12. Design system: tokens

### Color: monochrome palette + accents

There is **one canonical color palette** in `constants/ThemePalettes.ts` — it's just Tailwind's `neutral` ramp. Light mode uses it as-is; dark mode uses `invertPalette()` (50 ↔ 950, 100 ↔ 900, etc.; 500 stays put).

```ts
export const MONO_PALETTE = {
  50:  '#fafafa',  // app bg, lightest surfaces (Tailwind neutral-50)
  100: '#f5f5f5',  // card bg, subtle borders (neutral-100)
  200: '#e5e5e5',  // (neutral-200)
  300: '#d4d4d4',  // (neutral-300)
  400: '#a3a3a3',  // (neutral-400)
  500: '#737373',  // muted secondary text — most common 'quiet' color (neutral-500)
  600: '#525252',  // (neutral-600)
  700: '#404040',  // emphasis text (neutral-700)
  800: '#262626',  // (neutral-800)
  900: '#171717',  // (neutral-900)
  950: '#0a0a0a',  // primary text, headings (neutral-950)
};

export function invertPalette(p) {
  return {
    50: p[950], 100: p[900], 200: p[800], 300: p[700], 400: p[600],
    500: p[500], 600: p[400], 700: p[300], 800: p[200], 900: p[100], 950: p[50],
  };
}
```

**Never render pure black on pure white.** Use `theme[950]` on `theme[50]` (and vice versa for dark mode) — it reads as near-black on near-white but is softer and passes WCAG AA.

### Brand accents (theme-independent)

```ts
export const ACCENT_COLORS = {
  pink:   '#ff0088',   // sign-in halo, Pill 'pink', SolanaUploadArrow gradient, devnet warning text
  cyan:   '#00d4ff',   // Pill 'cyan' (active/open status)
  lime:   '#4cd900',   // Pill 'lime' (success/awarded/sold/paid status)
  orange: '#ff5900',   // Pill 'orange' (failed status)
};

export const BRAND_ACCENT = '#0ea5e9';   // Tailwind sky-500. Role-select selected card.
```

### Status color (one fixed exception)

Destructive actions (sign-out icon, delete account, error states): **`#DC143C`** (crimson). This is the *only* hardcoded hex outside of `ACCENT_COLORS` and is intentional.

### Signal palette (charts / decorative — Tailwind direct)

```ts
SIGNAL_PALETTE = {
  red: tw.red, yellow: tw.amber, green: tw.emerald, sky: tw.sky,
  blue: tw.blue, indigo: tw.indigo, purple: tw.purple, pink: tw.pink,
};
```

Reserved for future analytics dashboards (the `components/ui/charts/*` primitives are kept in the codebase but not used in v1 screens).

### Typography (Geist)

Use `next/font/google` with the Geist family. Two weights: 400 + 600.

```ts
// app/layout.tsx
import { Geist } from 'next/font/google';
const geist = Geist({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-geist' });
```

Variant scale (mirror `components/base/ThemedText.tsx` exactly — these are the tokens used throughout the app):

| Variant | Family | Size / Line | Letter spacing |
|---|---|---|---|
| h1 | Geist SemiBold | 48 / 56 | -0.03em |
| h2 | Geist SemiBold | 36 / 44 | -0.03em |
| h3 | Geist SemiBold | 28 / 36 | -0.03em |
| h4 | Geist SemiBold | 24 / 32 | -0.03em |
| h5 | Geist SemiBold | 20 / 28 | -0.03em |
| h6 | Geist SemiBold | 18 / 26 | -0.03em |
| body-3xl / -semibold | Geist 400 / 600 | 24 / 32 | -0.03em |
| body-2xl / -semibold | Geist 400 / 600 | 20 / 28 | -0.03em |
| body-xl / -semibold | Geist 400 / 600 | 18 / 26 | -0.03em |
| body-lg / -semibold | Geist 400 / 600 | 16 / 24 | -0.03em |
| body-md / -semibold | Geist 400 / 600 | 14 / 20 | -0.03em |
| body-sm / -semibold | Geist 400 / 600 | 13 / 18 | -0.03em |
| body-xs / -semibold | Geist 400 / 600 | 12 / 16 | -0.03em |
| caption / -semibold | Geist 400 / 600 | 11 / 14 | -0.03em |
| label   / -semibold | Geist 400 / 600 | 11 / 14 | -0.03em |

**Default colors per variant** (override-able via `style`):
- All headings (`h*`) → `theme[950]`.
- Larger body sizes (`body-lg`, `body-md`, `body-xl`, `body-2xl`, `body-3xl`, with or without `-semibold`) → `theme[950]`.
- Smaller body / UI (`body-sm`, `body-xs`, `caption`, `label`) → `theme[500]`.

**Capitalization rule:** Never use ALL CAPS for body text. ALL CAPS is permitted only for short labels, badges, or single-word emphasis (e.g. `PACKAGE`, `GIG`, `DEVNET`, `CREATOR`, `BRAND`) and only with `caption-semibold` paired with letterSpacing `0.6`.

**Metric typography:** Numbers and units render close together with no extra space (`0.5 SOL`, not `0.5  SOL`). The KPI component handles this with `flex items-baseline gap-2`.

### Spacing tokens (`tailwind.config.js`)

```js
spacing: {
  xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '20px',
  '2xl': '24px', '3xl': '32px', '4xl': '48px',
  // semantic aliases
  screen: '16px',  // px-screen — horizontal page padding
  section: '24px', // gap-section — between major sections
  item: '8px',     // gap-item — between list items
}
```

### Radius tokens

```js
borderRadius: {
  xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '24px',
  // semantic aliases
  input: '8px',
  button: '12px',
  card: '12px',
  sheet: '24px',  // bottom sheets / modals
}
```

### Layout constants (web equivalents)

| Mobile token | Mobile value | Web equivalent |
|---|---|---|
| `TAB_BAR_HEIGHT` | 60 | 64 (sticky bottom nav on mobile breakpoint) |
| `BottomInset.scrollWithTabBar` | 60 + 60 | 124 bottom padding under feed lists |
| `AnimationDuration.fast` | 150 | 150ms |
| `AnimationDuration.normal` | 200 | 200ms |
| `AnimationDuration.slow` | 300 | 300ms |
| `AnimationDuration.sheet` | 400 | 400ms |
| `AnimationDuration.page` | 500 | 500ms |

Iframes / safe areas: web has no notch/home-indicator concerns; just use `pb-[env(safe-area-inset-bottom)]` to be safe on iOS Safari.

### Theme persistence

Mirror `ThemeContext`:
- 3 modes: `system | light | dark`. Default = `system`.
- Persist in `localStorage` under key `user_color_scheme`.
- "system" resolves at render time via `window.matchMedia('(prefers-color-scheme: dark)')`.
- Apply via `<html data-theme="...">` + Tailwind's `dark:` variant or via CSS variables that flip on a `.dark` class on `<html>`.

Web persistence keys (mirror `lib/constants/storageKeys.ts`):

```ts
export const STORAGE_KEYS = {
  CACHED_PROFILE: 'cached_profile',
  COLOR_SCHEME: 'user_color_scheme',
  ONBOARDING_SEEN: 'onboarding_seen',
};
```

---

## 13. Design system: components

These are the components used across the app. For each, build a web equivalent that matches the props and semantics. Names below match `components/ui/*` and `components/base/*`.

### Base

- **`ThemedText`** — the typography primitive. Props: `type` (variant), `align`. Default color is auto-derived from variant (see §12).
- **`ThemedView`** — `<div>` with `theme[50]` background. Use as the root of every page.
- **`ScreenHeader`** — 48px tall row. Back chevron (left) + title (`body-xl-semibold`) + optional 1–2 action icons (right). 22px icon size, 44pt slot.
- **`SectionLabel`** — `caption-semibold` in `theme[500]`. Mixed case (not ALL CAPS). Sits above body content as an eyebrow.
- **`ErrorBoundary`** — wraps the app, renders fallback UI on uncaught errors.
- **`OfflineBanner`** — sticky banner that appears when offline (mirrors `runIfOnline` semantics from `AuthContext`).
- **`LoadingScreen`** / **`InitialLoadingScreen`** — centered spinner; first-launch variant uses the eagle loader described below.

### UI primitives

- **`Button`** — `primary | secondary | tertiary | inline | destructive` × `default | sm | lg | icon`.
  - `primary` = `theme[950]` bg, `theme[50]` text (the brand black-on-white control).
  - `secondary` = `theme[100]` bg, `theme[950]` text.
  - `tertiary` = `theme[200]` bg, `theme[950]` text.
  - `inline` = transparent bg.
  - `destructive` = `red-500` bg, `red-50` text.
  - Sizes: sm `h-10 px-3`, default `h-12 px-4`, lg `h-14 px-6`, icon square.
  - Radius: `rounded-button` (12px).
  - `loading=true` shows an inline spinner of the text color.
  - On press: scale to 0.95 over 100ms (`Easing.out(quad)`), back over 100ms.
  - `haptic('light')` on tap (no-op on web; use a subtle CSS scale animation as the visual replacement — see §22).
- **`Card`** — variants: `outline` (1px `theme[100]` border) · `filled` (`theme[100]` bg) · `borderless` · `border-top` · `border-bottom` · `border-y`. All except borderless: `p-3 rounded-card` (12px). The `border-*` variants are for divider-style list rows in Settings.
- **`BottomSheet`** (web: drawer + dialog) — props: `visible`, `onClose`, `title`, `height`, `dismissible`, `keyboardAware`, `leftAction`, `rightAction`, `flush`. Header: optional left action icon (44px slot) + centered title (`h6`) + 0–2 right action icons. Drag handle on mobile (`w-10 h-1 rounded-full theme[300]`). Backdrop is a 20% black overlay with a 80-intensity blur. On web desktop, render as a dialog at width=600px.
- **`KPI`** — large amount display.
  - `md`: 36px Geist SemiBold, line-height 44, letter-spacing -1.08. Unit: `body-md-semibold` in `theme[500]`.
  - `lg`: 56px / 64 / -1.68. Unit: `body-lg-semibold` in `theme[500]`.
  - Render: `<div class="flex items-baseline gap-2">{amount}<span>{unit}</span></div>`.
- **`Pill`** — small status/category pill. 6 intents:
  - `pink` = bg `#ff0088`, fg `theme[950]`
  - `orange` = bg `#ff5900`, fg `theme[950]`
  - `cyan` = bg `#00d4ff`, fg `theme[950]`
  - `lime` = bg `#4cd900`, fg `theme[950]`
  - `neutral` = bg `theme[200]`, fg `theme[950]`
  - `dark` = bg `theme[950]`, fg `theme[50]`
  - Padding 10px H × 5px V, fully rounded (`rounded-full`), self-start, `caption-semibold`.
- **`WalletPill`** — bg `theme[100]`, height 36, px-3, rounded-full. Renders `body-md-semibold` amount + `caption-semibold` "SOL". Shows spinner while loading. Tap → opens Wallet sheet.
- **`Avatar`** — 3 sizes: `sm` 32, `md` 44, `lg` 56. Circular. Falls back to single-letter initial in `theme[200]` bg.
- **`FilterChip`** — pill that toggles a filter. Active = `theme[950]` bg + `theme[50]` text; inactive = `theme[100]` bg + `theme[700]` text. `body-sm-semibold`, px-3.5 py-2, rounded-full.
- **`UnderlineTabBar`** — left-aligned label tabs with a 32×2 indicator under the active label. Active = `theme[950]` text + pink (`#ff0088`) indicator; inactive = `theme[400]` text + transparent indicator. Gap 24 between tabs.
- **`InboxRow`** — a list row with title (`body-md-semibold`/`theme[950]`), subline (`body-sm`/`theme[500]`), and a chevron-right.
- **`ListingCard`** — feed card. Hero (130px tall) is either `mediaUrls[0]`/`coverImageUrl` or a peach gradient `linear-gradient(180deg, #ffd6a8 → #ffccd4)`. Bookmark heart in top-right corner, 36×36, 55%-black bg, white icon (filled when saved). Body (`p-4 gap-3`):
  - Top row: `KPI md` (left) + status pills row (right) — category pill + kind pill.
  - Title: `body-lg-semibold`, max 2 lines.
  - Meta row: tappable `@username` (`body-sm-semibold`/`theme[700]`) + `·` + `formatRelative(createdAt)` (`body-sm`/`theme[500]`). Tapping the username navigates to `/profile/{ownerId}`.
- **`RoleSelectCard`** — large card with title + description, distinct selected state (filled with `BRAND_ACCENT` sky bg, white text).
- **`EmptyState`** — centered: optional icon (60% opacity), `h6` title, `body-md` description in `theme[400]`, optional primary action button. Centered, max-width sm.
- **`CtaFooter`** — sticky bottom container for the page's primary CTA. `theme[50]` bg, `pt-3 px-4 pb-[env(safe-area-inset-bottom)+12px]`. Optional helper text below in `body-xs`/`theme[500]` centered.
- **`TextInput`** — generic text input. Props mirror RN: `value`, `onChangeText`, `placeholder`, `multiline`, `maxLength`, `autoCapitalize`, `autoCorrect`, `keyboardType`, `error`, `leftIcon`. `theme[100]` bg, `rounded-input` (8px), `body-md` text. On error: 1px `red-500` border.
- **`NumberInput`** — variant of TextInput with `inputmode="decimal"` and `parseSolAmount` for validation. Accepts `.` or `,` decimal separator.
- **`Skeleton`** — shimmer loader. Use during initial query loads.
- **`Alert`** — inline non-intrusive alert (info / warning / error variants). Uses `ThemeColors.status.*`.
- **`PopoverMenu`** — tap-to-reveal menu (replaces context menus). On web: shadcn/ui's Popover.
- **`SegmentedToggle`** — pill-style segmented control (used for filter selection within sheets).
- **`ProgressBar`** — slim horizontal progress.
- **`HapticRefreshControl`** — pull-to-refresh wrapper. Web: replace with explicit "Refresh" button or pull-to-refresh polyfill on touch.
- **`SolanaUploadArrow`** — the oversized center icon on the tab bar / Create button. Pink gradient triangle with two horizontal bars below (looks like an upload glyph). See `components/ui/SolanaUploadArrow.tsx` for the exact paths — port verbatim per Rule Zero (do NOT redraw).
- **`AdlerEagleLogo`** — sign-in / intro hero. ViewBox 133×171. Source SVG: `assets/images/eagle-compact.svg` (in the mobile repo). Copy the file into the web repo's `public/` and render via `<img>` or inline `<svg>` — never redraw.
- **`EagleLoader`** — animated eagle. Cycles fill color through pink → cyan → lime → orange every 4s. The path data lives in `components/ui/EagleLoader.paths.ts` (a bit-string `A` selecting which paths get the accent fill). Use it for the initial loading screen. On web, port the same Skia approach to SVG + Framer Motion or a CSS keyframe animation on the relevant paths.

### Tab bar (`AdlerTabBar`)

Custom 5-slot bar: `browse, saved, create, inbox, profile`. The "create" slot is **not navigable** — it's an oversized button that opens the global Create sheet. Center button uses `SolanaUploadArrow`. Other slots: 22px Lucide icons (`Compass`, `Bookmark`, `Inbox`, `User`). Active slot: icon color = `theme[950]`. Inactive: `theme[400]`. Always render labels in screen-reader / a11y attributes — visually icon-only.

### Toast

Position: top, 60px from the top edge. Animation in: 50ms. Semantic API:

```ts
toast.success('Payment sent · 4kqK3Z…');
toast.error('Insufficient SOL — your balance is 0.05, you need 0.5001…');
toast.info('Address copied');
toast.warn('Wallet not ready yet');
toast.hide();
```

On web, implement via shadcn/ui's `Toaster` or `sonner`.

---

## 14. State management

### Server state — TanStack Query

QueryClient defaults (mirror `contexts/QueryProvider.tsx`):

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min
      gcTime: 30 * 60 * 1000,          // 30 min
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});
```

On the wallet balance (used in 3 places — `AdlerHomeHeader`, `ProfileHeader`, `WalletSheet`):
- `refetchInterval: 30_000`
- `staleTime: 15_000`

### Global state — React Contexts

| Context | Purpose | Where |
|---|---|---|
| `AuthContext` | Privy + Firebase user, walletAddress, online status, signOut | `contexts/AuthContext.tsx` |
| `UserContext` | Cached profile, hasRole, refreshProfile | `contexts/UserContext.tsx` |
| `ThemeContext` | Color scheme, theme palette, isDark | `contexts/ThemeContext.tsx` |
| `OverlaySheetsContext` | Controls global Create / Wallet / RoleSwitch sheets | `contexts/OverlaySheetsContext.tsx` |

### Profile SWR pattern

`UserContext` does cache-first profile loading:

1. On user change, read `localStorage[CACHED_PROFILE]`. Hydrate immediately if present and matches `user.id`.
2. Then call `ensureProfileExists(uid, walletAddress)` to revalidate (it's idempotent — see §21).
3. On success, write back to `localStorage` and Sentry user context.
4. On failure, fall back to `getProfile(uid)` and use whatever's cached.

The `pushSyncedFor` ref ensures push token registration runs at most once per user per launch (see §22).

### Local state

Use `useState` for forms, sheets, transient UI. No Redux. No Zustand. Inputs validate on submit, not on every keystroke (`submitAttempted` flag — see `CreateFormStep`).

### Online/offline detection

```ts
const [isConnected, setIsConnected] = useState(true);
useEffect(() => {
  const set = () => setIsConnected(navigator.onLine);
  window.addEventListener('online',  set);
  window.addEventListener('offline', set);
  // Debounce 300ms via `setTimeout(set, 300)` if needed (mobile does this).
  return () => {
    window.removeEventListener('online',  set);
    window.removeEventListener('offline', set);
  };
}, []);
```

---

## 15. TanStack Query keys

Mirror `lib/constants/queryKeys.ts` exactly:

```ts
export const PROFILE_KEYS = {
  profile: (userId) => ['profile', userId],
  walletBalance: (address) => ['wallet', 'balance', address],
};
export const PACKAGE_KEYS = {
  list: (filter) => ['packages', filter ?? {}],
  detail: (packageId) => ['package', packageId],
  bySeller: (sellerId) => ['packages', 'seller', sellerId],
};
export const GIG_KEYS = {
  list: (filter) => ['gigs', filter ?? {}],
  detail: (gigId) => ['gig', gigId],
  byBrand: (brandId) => ['gigs', 'brand', brandId],
};
export const APPLICATION_KEYS = {
  forGig: (gigId) => ['applications', 'gig', gigId],
  byCreator: (creatorId) => ['applications', 'creator', creatorId],
  byBrand: (brandId) => ['applications', 'brand', brandId],
};
export const ORDER_KEYS = {
  asBuyer: (buyerId) => ['orders', 'buyer', buyerId],
  asSeller: (sellerId) => ['orders', 'seller', sellerId],
  detail: (orderId) => ['order', orderId],
};
export const REVIEW_KEYS = {
  forOrder: (orderId) => ['reviews', 'order', orderId],
  byReviewee: (revieweeId) => ['reviews', 'reviewee', revieweeId],
};
export const SAVE_KEYS = { byUser: (userId) => ['saves', 'user', userId] };
export const FEED_KEYS = { browse: (filter) => ['feed', 'browse', filter ?? {}] };
```

### Invalidation patterns

| After this mutation | Invalidate these keys |
|---|---|
| `createPackage` | `FEED_KEYS.browse()`, `PACKAGE_KEYS.bySeller(uid)` |
| `createGig` | `FEED_KEYS.browse()`, `GIG_KEYS.byBrand(uid)` |
| `updatePackageStatus` | `PACKAGE_KEYS.detail(id)`, `PACKAGE_KEYS.bySeller(uid)`, `FEED_KEYS.browse()` |
| `updateGigStatus` | `GIG_KEYS.detail(id)`, `GIG_KEYS.byBrand(uid)`, `FEED_KEYS.browse()` |
| `applyToGig` | `APPLICATION_KEYS.forGig(gigId)`, `APPLICATION_KEYS.byCreator(uid)` |
| `updateApplicationStatus` (award) | `GIG_KEYS.detail(gigId)`, `APPLICATION_KEYS.forGig(gigId)` |
| `payForListing` | `ORDER_KEYS.asBuyer(uid)`, `PROFILE_KEYS.walletBalance(address)` |
| `markOrderStatus` (any) | `ORDER_KEYS.detail(id)`, `ORDER_KEYS.asBuyer(buyerId)`, `ORDER_KEYS.asSeller(sellerId)` |
| `submitReview` | `REVIEW_KEYS.forOrder(orderId)` |
| `transferSol` (Wallet→Send) | `PROFILE_KEYS.walletBalance(address)` |
| `addSave` / `removeSave` | optimistic; final `invalidate({ queryKey: SAVE_KEYS.byUser(uid) })` on settle |

---

## 16. UX principles (12 rules)

These rules apply to every screen. They're inherited from `.claude/rules/ux-principles.md` with mobile-isms translated for the web.

### 1. First-run architecture

- **60-second time-to-value.** Sign in → role → Browse with no detours.
- Pre-fill anything that can be inferred (display name + username are auto-generated server-side via `ensureProfileExists`).
- No guest mode in v1 — payments require a Privy wallet, so sign-in is mandatory.

### 2. Navigation

- 4 destinations + 1 oversized create action. Mobile: bottom tab bar. Desktop: left sidebar.
- **Browse is the home screen.** It surfaces the wallet balance, role, and the live feed in one glance.
- **Spatial layout: F/Z scanning patterns.** Most decision-relevant data goes top-left (price/budget in the heaviest type), status/kind labels go top-right, descriptive content flows below.
- Support gestures where they exist: pull-to-refresh on feeds, swipe-back for stack screens. On web, browser back is the equivalent of swipe-back; don't override it.

### 3. Single-task focus

- **One action per screen.** Checkout has *one* primary button and *one* core data point (the SOL amount). Role select has 2 cards but only one active choice at a time.
- Place all primary CTAs in the **bottom 40%** of the viewport on mobile (thumb zone). On desktop, the bottom-of-card sticky CTA stays in the natural reach for trackpad/mouse users.
- All interactive elements ≥ 44×44 px. Primary checkout/purchase buttons are oversized (`size="lg"`).

### 4. Button architecture

| Type | Visual | Use |
|---|---|---|
| Primary | Full-width, `theme[950]` bg, bold | The single most important action ("Pay 0.5 SOL", "Submit application") |
| Secondary | `theme[100]` bg, `theme[950]` text | "Edit", "Cancel", "Save draft" |
| Tertiary | `theme[200]` bg | Low-priority navigation |
| Destructive | `#DC143C` family | Sign out, Delete account, Delete listing |

- Labels: ≤ 3 words, action-oriented. **State exactly what happens.** "Pay 0.5 SOL" not "Submit". "Award 1 SOL" not "Confirm".
- Modal pairs: secondary on the left, primary on the right (forward-progression).
- Buttons trigger state changes. **Links** trigger navigation. Don't interchange.

### 5. Typography

- See §12 for the variant scale. **Never pure `#000000` on `#FFFFFF`** — use `theme[950]` on `theme[50]`.
- ALL CAPS only for badges/single-word emphasis with `caption-semibold` + 0.6 letter-spacing.
- Bring numbers and units close: `0.5 SOL`, not `0.5  SOL`.

### 6. Data visualization

Reserved for a future analytics dashboard. The chart primitives in `components/ui/charts/` (BarChart, DonutChart, CalendarHeatmap) are kept but unused in v1. When implementing on web, replace Skia with `recharts` or `visx`. Apply the chart rules from the mobile guide:
- No hover states (touch). Use tap-to-reveal tooltips with offset so the cursor doesn't obscure them.
- No scroll hijacking.
- Bar charts sorted ascending or descending unless chronological.
- Pre-aggregate large datasets server-side.

### 7. Dashboard / card layout

- **One screen, one thought.** Don't replicate desktop analytical density on small viewports.
- Most-important number is *immediately* visible without scrolling (Browse → wallet balance pill; Package → KPI price; Checkout → KPI amount).
- Whitespace is structural — use generous gaps (12–24 px) between cards, not borders or dividers.

### 8. Accessibility & color

- WCAG ratios: 4.5:1 for body, 3:1 for large text and icons.
- **Never rely solely on color to communicate status.** Pair every status pill with a structural cue (icon, weight, or pattern).
- Multi-series charts pair blue with **orange** for color-blindness safety.

| Status | Color | Pair with |
|---|---|---|
| Success / paid / awarded | `lime` (#4cd900) or Tailwind green-500 | check icon |
| Warning / pending | amber-500 | warning icon |
| Error / failed / destructive | `#DC143C` | bold weight, alert icon |
| Neutral data | `theme[500]` (secondary), `theme[700]` (tertiary) |   |

### 9. Multi-sensory feedback (web adaptation)

Mobile uses haptics (`light/medium/heavy`). Web doesn't have system haptics — use **subtle motion** as the equivalent:

| Mobile haptic | Trigger | Web equivalent |
|---|---|---|
| `light` | Tab press, card tap, role pill toggle | 95% scale-down on press for 100ms |
| `medium` | Pay tap, apply submit | Same scale-down + 80ms button glow flash |
| `heavy` | Payment confirmed, award succeeded | Toast + brief 1.05× scale on the success element |
| `success` | Confirmable success | Toast |
| `error` | Recoverable error | Toast + shake animation on the offending field |

Keep the language consistent across the app — same intensity for the same conceptual moment.

### 10. Empty states

Empty states are activation real estate. All copy lives in `lib/utils/copy.ts` (see §17). Required:

1. Empathetic, on-brand title.
2. Action-oriented description.
3. Primary CTA when relevant (e.g. "List a package").

Distinguish "no listings exist" from "filter narrows it to zero" (see Browse).

### 11. Error handling

- Plain language only. No error codes. No developer terminology.
- Explain **what** went wrong + **why** + **next step**.
- Never block payment-in-progress UI with a full-screen modal. Surface inline / via toast and keep `pending` orders alive for retry.
- Hierarchy: informational toast → persistent banner → bottom sheet → modal (only for data loss / failed payment).

### 12. Screen reader & narrative summaries

- Every interactive element gets `aria-label` and proper `role`. Mirror the `accessibilityLabel` / `accessibilityHint` props in mobile components.
- For complex visualizations (future analytics), include a "highlight card" plain-language summary (e.g. "Your weekly volume is up 8% compared to last month").

---

## 17. Copy strings

These are the centralized strings in `lib/utils/copy.ts`. Copy verbatim — they're tone-tested.

```ts
export const EMPTY_BROWSE = {
  title: 'Quiet on the wire',
  description: 'When creators ship packages and brands post gigs, they land here.',
};

export const EMPTY_BROWSE_SEARCH = {
  title: 'No matches',
  description: 'Try a broader term, clear a filter, or pull to refresh.',
};

export const EMPTY_INBOX_PURCHASES = {
  title: 'No purchases yet',
  description: 'Buy your first package and it shows up here with the on-chain receipt.',
};
export const EMPTY_INBOX_SALES = {
  title: 'No sales yet',
  description: 'Once a brand buys one of your packages, the order appears here.',
};
export const EMPTY_INBOX_APPLICATIONS = {
  title: 'No applications yet',
  description: 'Pitch a gig from the Browse tab and your applications track here.',
};

export const EMPTY_PACKAGES_BY_SELLER = {
  title: 'No packages yet',
  description: 'Hit the Create tab to publish your first one.',
};
export const EMPTY_GIGS_BY_BRAND = {
  title: 'No gigs yet',
  description: 'Hit the Create tab to post your first brief.',
};
export const EMPTY_GIG_APPLICATIONS = {
  title: 'No applications yet',
  description: 'When creators apply, their pitches show up here.',
};

export const EMPTY_SAVED = {
  title: 'Nothing saved yet',
  description: 'Bookmark a package or gig from Browse and it lands here.',
};

export const EMPTY_WALLET_BALANCE = {
  title: 'Wallet is empty',
  description: 'On devnet, fund yourself with the Solana CLI to start buying or sending.',
};
```

### Other in-product copy

- Sign-in legal: `"By continuing you accept our Terms of Service and Privacy Policy."`
- Devnet warning (caption near amounts): `"Devnet · this is test SOL, not real funds"`.
- Award sheet body: `"This sends a Solana transfer from your embedded wallet. The gig will be marked as awarded."`
- Sign-out body: `"Sign out of Adler? You'll need to sign back in to see your wallet, listings, and orders."`
- Delete-account body: `"This permanently removes your profile, username, and active listings. Your past orders and applications stay on the books for the other side's records."` + caption: `"On-chain transactions can't be undone. Withdraw any SOL from your wallet first."`
- Role-switch body: `"Switching role changes which tabs and flows you see. Your wallet, listings, and history stay intact."`
- About-screen tagline: `"Adler is a two-sided UGC marketplace settled on Solana. Built by emptea."`
- Wallet devnet hint: `"On devnet, fund your wallet with the Solana CLI: solana airdrop 1 <address> --url devnet"` (rendered in semibold).

---

## 18. Categories

Listed in the Firestore rules — must stay in sync. Mirror `lib/constants/categories.ts`:

```ts
export const CATEGORIES = ['beauty', 'fitness', 'health', 'education', 'food', 'lifestyle', 'general'] as const;
export type Category = typeof CATEGORIES[number];
```

Display labels (mirror `components/features/browse/filterTypes.ts`):

```ts
const CATEGORY_LABELS: Record<Category, string> = {
  beauty:    'Beauty',
  fitness:   'Fitness',
  health:    'Health',
  education: 'Education',
  food:      'Food',
  lifestyle: 'Lifestyle',
  general:   'General',
};
```

Category → Pill intent map (used on listing cards):

```ts
const CATEGORY_INTENT = {
  beauty: 'pink', skincare: 'pink',
  fitness: 'cyan', health: 'cyan',
  education: 'orange',
  food: 'lime', lifestyle: 'lime',
};
// fallback: 'neutral'
```

### Browse filter shapes

```ts
export type SortBy = 'date' | 'priceAsc' | 'priceDesc';
export type PriceRange = 'all' | 'under0_1' | '0_1to1' | 'over1';

export const PRICE_RANGE_OPTIONS = [
  { id: 'all',       label: 'Any price',     predicate: () => true },
  { id: 'under0_1',  label: 'Under 0.1 SOL', predicate: (s) => s < 0.1 },
  { id: '0_1to1',    label: '0.1 – 1 SOL',   predicate: (s) => s >= 0.1 && s <= 1 },
  { id: 'over1',     label: 'Over 1 SOL',    predicate: (s) => s > 1 },
];
```

Filters apply **client-side** — the feed pages are small enough that this is fine.

---

## 19. Order state machine

`OrderStatus` is `pending | paid | delivered | complete | failed`. The state machine is enforced by the security rule (§7).

```
              created by buyer
                    |
                    v
                 pending
                  /    \
        (buyer aborts)  (buyer + tx signature)
              |              |
              v              v
            failed          paid
                              |
                       (seller marks)
                              |
                              v
                          delivered
                              |
                       (buyer confirms)
                              |
                              v
                          complete
```

Per-actor rules:
- **Buyer can move:** `pending → paid` (must include `txSignature`), `pending → failed`, `delivered → complete`.
- **Seller can move:** `paid → delivered`.
- **Either can write a no-op** (status unchanged, only `updatedAt` changes).
- **`txSignature` is append-only** — once set, it can never change.
- **Reviews open** when `status === 'complete'`. One review per reviewer per order (deterministic doc id `${orderId}_${reviewerId}`).

The `reconcilePendingOrders` Cloud Function flips `pending` orders older than 1 hour to `failed` every 30 minutes — defensive sweep for crash-mid-tx cases.

---

## 20. Saves (bookmarks)

Mirror `lib/services/saveService.ts` and `hooks/useSaves.ts`.

- Doc id is deterministic: `${userId}_${kind}_${listingId}` (rule-enforced).
- Optimistic mutation pattern:

```ts
const mutation = useMutation({
  mutationFn: async ({ kind, id, currentlySaved }) => {
    if (currentlySaved) await removeSave(kind, id);
    else                await addSave(kind, id);
  },
  onMutate: async ({ kind, id, currentlySaved }) => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData<Save[]>(queryKey) ?? [];
    const next = currentlySaved
      ? previous.filter((s) => !(s.kind === kind && s.listingId === id))
      : [{ id: `optimistic_${kind}_${id}`, userId, kind, listingId: id, createdAt: Date.now() }, ...previous];
    queryClient.setQueryData(queryKey, next);
    return { previous };
  },
  onError: (_, __, ctx) => ctx?.previous && queryClient.setQueryData(queryKey, ctx.previous),
  onSettled: () => queryClient.invalidateQueries({ queryKey }),
});
```

The bookmark heart on `ListingCard` toggles instantly; the server write reconciles in the background.

---

## 21. Profiles, usernames, reservations

Mirror `lib/services/profileService.ts`.

### `ensureProfileExists(userId, walletAddress)` — idempotent transaction

```ts
import { runTransaction, doc, serverTimestamp } from 'firebase/firestore';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const ADJECTIVES = ['Lunar','Solar','Crimson','Indigo','Velvet','Neon','Quartz','Onyx','Coral','Mirage','Echo','Drift','Vapor','Ember','Nova','Cipher'];
const NOUNS      = ['Studio','Lab','Atelier','Forge','Loft','Press','Foundry','Frame','Reel','Lens','Pulse','Wave','Cell','Crew','Field','Range'];
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

function generateUsername(userId: string): string {
  const adj = pick(ADJECTIVES).toLowerCase();
  const noun = pick(NOUNS).toLowerCase();
  const idTail = userId.replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase();
  const suffix = idTail.length >= 4 ? idTail : Math.floor(1000 + Math.random() * 9000).toString();
  return `${adj}${noun}${suffix}`;          // e.g. 'lunarstudio3a4f'
}

function generateDisplayName(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;  // e.g. 'Lunar Studio'
}

export async function ensureProfileExists(userId, walletAddress) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, 'profiles', userId);
    const snap = await tx.get(ref);

    if (snap.exists()) {
      // existing profile path — backfill missing username claim & wallet
      const data = snap.data();
      const existingUsername = data.username;
      let backfillUsernameClaim = false;
      if (existingUsername) {
        const slugSnap = await tx.get(doc(db, 'usernames', existingUsername));
        backfillUsernameClaim = !slugSnap.exists();
      }
      if (walletAddress && !data.walletAddress) {
        tx.update(ref, { walletAddress, updatedAt: serverTimestamp() });
      }
      if (backfillUsernameClaim && existingUsername) {
        tx.set(doc(db, 'usernames', existingUsername),
          { userId, createdAt: serverTimestamp() });
      }
      return { ...mapProfile(snap.id, data),
               walletAddress: walletAddress ?? data.walletAddress ?? null };
    }

    // first-time path
    const username = generateUsername(userId);
    const slugRef = doc(db, 'usernames', username);
    if ((await tx.get(slugRef)).exists()) {
      throw new Error(`Generated username ${username} collided. Try signing in again.`);
    }
    tx.set(slugRef, { userId, createdAt: serverTimestamp() });
    tx.set(ref, {
      role: null,
      username,
      displayName: generateDisplayName(),
      bio: '',
      avatarUrl: null,
      walletAddress,
      pushToken: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return /* the freshly-built profile */;
  });
}
```

Important: All `tx.get` calls must precede all writes inside a transaction.

### `updateProfile(uid, patch)` — username changes are transactional

When the username changes, the slug write, the old slug release, and the profile write happen in one transaction:

```ts
await runTransaction(db, async (tx) => {
  const profileRef = doc(db, 'profiles', userId);
  const newSlugRef = doc(db, 'usernames', patch.username);
  const profile = await tx.get(profileRef);
  const oldUsername = profile.data().username;

  if (oldUsername === patch.username) {
    tx.update(profileRef, { ...patch, updatedAt: serverTimestamp() });
    return;
  }
  const newSlug = await tx.get(newSlugRef);
  if (newSlug.exists() && newSlug.data().userId !== userId) {
    throw new Error('That username is taken.');
  }
  if (!newSlug.exists()) {
    tx.set(newSlugRef, { userId, createdAt: serverTimestamp() });
  }
  if (oldUsername && oldUsername !== patch.username) {
    tx.delete(doc(db, 'usernames', oldUsername));
  }
  tx.update(profileRef, { ...patch, updatedAt: serverTimestamp() });
});
```

### `isUsernameAvailable(username, exceptUserId)` — best-effort pre-check

Used in the Edit Profile sheet to short-circuit obviously-taken usernames before submit. Not authoritative — the transactional update above is the source of truth.

### Validation ranges

| Field | Min | Max |
|---|---|---|
| `displayName` | 1 | 50 |
| `username` | 3 | 20, regex `^[a-z0-9_]{3,20}$` |
| `bio` | 0 | 280 |
| `avatarUrl` | 0 | 2048 |

---

## 22. Push notifications

Mobile uses Expo Push (`expo-notifications`) and persists a token at `profiles.pushToken`. The push triggers (`notifyApplicationReceived`, `notifyApplicationDecided`, `notifyOrderStateChanged`) target Expo push tokens via `https://exp.host/--/api/v2/push/send`.

**For the v1 web port:**
- **Skip web push.** Set `pushToken: null` for web users — they simply don't receive push from the existing triggers, which is fine.
- The Cloud Functions don't fail when `pushToken` is null (the helper checks `if (!token) return;`).

**If web push is desired later (v2):**
- Implement Web Push via the Push API + Service Worker.
- Add a new field `webPushSubscription` (or similar) to the profile, or extend `pushToken` semantics.
- Add a parallel sender in the Cloud Functions that targets web push.

---

## 23. Account deletion

App Store §5.1.1(v) requires user-initiated account deletion. The `deleteUserAccount` callable Cloud Function handles this server-side:

1. Archive the user's active packages (set `status: 'paused'`).
2. Close the user's open gigs (set `status: 'closed'`).
3. Delete the profile doc.
4. Delete the username slug claim.
5. Revoke the Firebase auth user (`admin.auth().deleteUser(uid)`).

Orders, applications, and reviews are **retained** for counter-party integrity. If the same Privy user signs back in, `ensureProfileExists` mints a fresh profile.

Web flow:

```ts
async function onDeleteAccount() {
  setDeleting(true);
  try {
    await deleteAccount();          // calls deleteUserAccount Cloud Function
    await signOut().catch(() => null);
    toast.success('Account deleted');
    router.replace('/sign-in');
  } catch (err) {
    toast.error(err?.message ?? 'Account deletion failed');
    setDeleting(false);
  }
}
```

The `DeleteAccountSheet` confirmation copy:
> This permanently removes your profile, username, and active listings. Your past orders and applications stay on the books for the other side's records.
>
> On-chain transactions can't be undone. Withdraw any SOL from your wallet first.

Two buttons: `Cancel` (secondary) + `Delete` (destructive, red).

---

## 24. Web-specific deviations

Mobile assumptions that change on web — call these out in code comments where they appear:

| Mobile pattern | Web replacement |
|---|---|
| `expo-haptics` | CSS scale animation on press; subtle audio cue is *optional* |
| `expo-notifications` (Expo Push) | None in v1; no web push |
| `expo-image-picker` (system photo library) | `<input type="file" accept="image/*">` (or drag-and-drop on desktop) |
| `expo-image-manipulator` | Canvas-based resize before upload |
| `expo-secure-store` | Not used in this codebase — Privy handles wallet keys |
| `expo-clipboard` | `navigator.clipboard.writeText()` |
| `react-native-qrcode-svg` | `qrcode.react` |
| `BottomSheet` (mobile sheet) | shadcn/ui Drawer < 768px, Dialog ≥ 768px |
| `AdlerTabBar` (4 + center) | Bottom bar < 768px; left sidebar with prominent Create button ≥ 768px |
| `useSafeAreaInsets()` | `env(safe-area-inset-*)` CSS where applicable |
| `Linking.openURL(url)` | `window.open(url, '_blank', 'noopener,noreferrer')` |
| `useColorScheme` (RN) | `window.matchMedia('(prefers-color-scheme: dark)')` |
| `AsyncStorage` | `localStorage` (synchronous; wrap calls if you want a Promise API) |
| `@shopify/react-native-skia` (EagleLoader, charts, SolanaUploadArrow) | Inline SVG + Framer Motion / CSS animations. **Path data must be copied verbatim** per Rule Zero of the design-code-migration rules — do not redraw any vector asset. |
| `react-native-reanimated` (Button scale, sheet drag) | Framer Motion or CSS transitions |
| `lucide-react-native` | `lucide-react` (drop-in API) |
| `nativewind` | Tailwind (the class names we already use are valid Tailwind classes) |
| Privy `@privy-io/expo` | `@privy-io/react-auth` + `@privy-io/react-auth/solana` for the embedded Solana wallet |
| Firebase JS SDK with `react-native-async-storage/async-storage` persistence | Firebase JS SDK web defaults (IndexedDB persistence) |
| `@react-native-firebase/app-check` (Apple App Attest) | `firebase/app-check` with `ReCaptchaEnterpriseProvider` |

### Polyfills

Mobile loads several polyfills before app boot (`react-native-get-random-values`, Buffer, `fast-text-encoding`, `@ethersproject/shims`). On web, the browser has all of these natively.

`@solana/web3.js@1.x` works in browsers without additional polyfills.

### Routing differences

- Use Next.js `useRouter().back()` and `router.push()` / `router.replace()`.
- For dynamic routes use the `[id]` folder convention.
- `useLocalSearchParams` (mobile) → `useSearchParams` (web).

---

## 25. Pre-launch checklist

Before flipping the web app live for paying users:

- [ ] All env vars set in production (Firebase, Privy, Solana RPC proxy URL, App Check site key).
- [ ] App Check enabled on the Firebase project (start in Monitor mode; flip to Enforce after confirming legit traffic).
- [ ] Firestore rules + indexes deployed (already done, but verify after any schema change).
- [ ] Storage rules deployed.
- [ ] Cloud Functions deployed (`mintFirebaseToken`, `solanaRpcProxy`, `deleteUserAccount`, scheduled + trigger functions).
- [ ] `solanaRpcProxy` function pointed at production Helius URL via `HELIUS_RPC_URL` secret.
- [ ] Sentry DSN wired up (or explicitly omitted with a one-line note).
- [ ] OAuth redirect URIs whitelisted in Privy and Apple/Google providers for the production domain.
- [ ] CORS allowed origins on the `solanaRpcProxy` function (already permissive — verify).
- [ ] Test the full flow on a fresh browser: sign in → role select → browse → buy a package on devnet → see the order in inbox → mark delivered (other account) → confirm receipt → leave a review.
- [ ] Confirm `walletAddress` matches between mobile and web for the same Privy user — the embedded wallet should be identical.
- [ ] Confirm Sign-out clears the React Query cache (`queryClient.clear()`).
- [ ] `pushToken: null` on web profiles — confirm push triggers don't error.
- [ ] Run a side-by-side visual diff of a key screen (Browse, Package detail, Checkout) against the mobile app at iPhone 15 Pro width (393×852) to catch token drift.

---

## Appendix A: Privy + wallet quick reference

```ts
import { usePrivy, useLoginWithOAuth } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';

// In a sign-in button
const { login } = useLoginWithOAuth({
  onError: (err) => {
    if (err?.message?.toLowerCase().includes('cancel')) return;  // user cancelled
    toast.error(err?.message ?? 'Sign-in failed');
  },
});
await login({ provider: 'apple' });   // or 'google'

// Anywhere
const { user, ready, getAccessToken, logout } = usePrivy();
const { wallets } = useSolanaWallets();
const wallet = wallets[0];                                   // user's embedded Solana wallet
const provider = await wallet.getProvider();                 // for transferSol()
const address = wallet.address;                              // base58 string
```

The exact Privy import paths and the `solana` sub-export are subject to the Privy web SDK version. Verify against [Privy's docs](https://docs.privy.io) at integration time. The semantic contract (one embedded Solana wallet per user, accessible via `wallets[0]`, with `getProvider()` exposing a `signAndSendTransaction` method) is stable.

---

## Appendix B: SOL formatting rules

Mirror `lib/utils/formatNumber.ts`:

```ts
// Strip trailing zeros and trailing decimal — whole numbers render without a decimal.
//   formatSol(1)        === '1'
//   formatSol(1.5)      === '1.5'
//   formatSol(1.234)    === '1.234'
//   formatSol(1.2345)   === '1.235'   // rounds at 3 decimals
//   formatSol(0.001)    === '0.001'
export const formatSol = (sol: number): string => {
  if (!Number.isFinite(sol)) return '—';
  return parseFloat(sol.toFixed(3)).toString();
};

// Strict parser. Accepts both '.' and ',' as decimal separator (DE/FR/CH locales).
// Returns null for any malformed input.
//   parseSolAmount('0.5')   === 0.5
//   parseSolAmount('0,5')   === 0.5
//   parseSolAmount('1abc')  === null   // rejects parseFloat quirks
export const parseSolAmount = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
```

Use `formatSol` everywhere a SOL amount is rendered; use `parseSolAmount` everywhere user input is read.

---

## Appendix C: Date formatting

Mirror `lib/utils/dates.ts`:

```ts
// Compact relative time — used on listing cards and inbox rows.
//   formatRelative(now - 30s)        === 'just now'
//   formatRelative(now - 5*60_000)   === '5m ago'
//   formatRelative(now - 2*3600_000) === '2h ago'
//   formatRelative(now - 5*86400_000)=== '5d ago'
//   formatRelative(now - 9*86400_000)=== '1w ago'
//   formatRelative(now - 60*86400_000)=== '2mo ago'
export function formatRelative(timestampMs: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestampMs);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`;
  const hr  = Math.floor(min / 60); if (hr < 24)  return `${hr}h ago`;
  const day = Math.floor(hr / 24);  if (day < 7)  return `${day}d ago`;
  const wk  = Math.floor(day / 7);  if (wk < 5)   return `${wk}w ago`;
  const mo  = Math.floor(day / 30); if (mo < 12)  return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

// Universal short formats
export const formatDisplayDate = (d: Date) =>
  `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;  // DD.MM.YYYY

// Profile "Joined Mar 2026"-style label
export const formatJoinedDate = (ms: number) =>
  new Date(ms).toLocaleString('en-US', { month: 'short', year: 'numeric' });
```

---

## Appendix D: External URLs

| Purpose | URL |
|---|---|
| Terms of Service | https://emptea.xyz/terms-of-service |
| Privacy Policy | https://emptea.xyz/privacy-policy |
| Support email | mailto:support@emptea.xyz |
| Solana Explorer base | https://explorer.solana.com |
| Solana devnet RPC fallback | https://api.devnet.solana.com |
| Solana mainnet RPC fallback | https://api.mainnet-beta.solana.com |
| Privy JWKS | https://auth.privy.io/api/v1/apps/{appId}/jwks.json |
| Cloud Function: `solanaRpcProxy` | https://us-central1-emptea-adler.cloudfunctions.net/solanaRpcProxy *(verify region after deploy)* |

---

If anything in this spec contradicts the mobile codebase, the **mobile codebase wins** — file an issue against this doc and we'll fix it.

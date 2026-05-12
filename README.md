# Adler

> Package manager: **pnpm** (use `pnpm install`, not npm).

A bounty marketplace built on Solana.

- **Anyone** can post a funded bounty (manual or auto settlement, with a submission window of 3 / 7 / 30 days).
- **Anyone** can submit to a bounty. The poster picks a winner (manual) or settlement runs automatically.

Funds escrow on-chain via the `adler-escrow` Anchor program on **Solana devnet** (mainnet flip is post-MVP). Authentication and embedded wallets are powered by **Privy**. Database, storage, and the auth bridge run on **Firebase**.

## Stack

- **App**: Expo 55, React Native 0.83, TypeScript, expo-router
- **Styling**: NativeWind 4 + Tailwind tokens
- **Auth**: `@privy-io/expo` (email OTP login + embedded Solana wallet)
- **Payments**: `@solana/web3.js` + `@coral-xyz/anchor` against devnet — Anchor escrow program `adler-escrow`
- **Backend**: Firebase Firestore + Storage + Cloud Functions (`mintFirebaseToken` bridges Privy JWT → Firebase custom token)

## Required environment variables

Add to `.env`:

```
EXPO_PUBLIC_PRIVY_APP_ID=
EXPO_PUBLIC_PRIVY_CLIENT_ID=
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_SOLANA_NETWORK=devnet
EXPO_PUBLIC_SOLANA_RPC_URL=
EXPO_PUBLIC_SOLANA_RPC_PROXY_URL=
EXPO_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY=
```

`EXPO_PUBLIC_SOLANA_RPC_URL` is required in dev (point at Helius devnet — public RPCs are rate-limited and unsupported). In production builds, set `EXPO_PUBLIC_SOLANA_RPC_PROXY_URL` to the deployed `solanaRpcProxy` Cloud Function URL instead, so the Helius key stays server-side. `EXPO_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` is web-only (App Check); skip it for iOS dev.

Cloud Function secrets (set via `firebase functions:secrets:set`):

```
PRIVY_APP_ID
PRIVY_APP_SECRET
HELIUS_RPC_URL_DEVNET
VERIFIER_KEYPAIR_BASE58
SUPER_ADMIN_UID
```

## First run

```sh
pnpm install
pnpm prebuild                    # regenerate iOS native dir (iOS-only)
pnpm ios                         # build & run on iOS
```

## Deploy backend

```sh
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

## Devnet wallet funding

```sh
solana airdrop 1 <wallet-address> --url devnet
```

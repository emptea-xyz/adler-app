# Adler

> Package manager: **pnpm** (use `pnpm install`, not npm).

A two-sided UGC marketplace built on Solana.

- **Creators** list content packages (video / images) for brands to purchase.
- **Brands** post gigs that creators apply to; the brand selects a winning applicant.

Payments settle as direct SOL transfers on **Solana devnet** (mainnet flip is post-MVP). Authentication and embedded wallets are powered by **Privy**. Database, storage, and the auth bridge run on **Firebase**.

## Stack

- **App**: Expo 55, React Native 0.83, TypeScript, expo-router
- **Styling**: NativeWind 4 + Tailwind tokens
- **Auth**: `@privy-io/expo` (email OTP login + embedded Solana wallet)
- **Payments**: `@solana/web3.js` against `api.devnet.solana.com`
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
```

Cloud Function secrets (set via `firebase functions:secrets:set`):

```
PRIVY_APP_ID
PRIVY_APP_SECRET
```

## First run

```sh
npm install
npx expo prebuild --clean        # regenerate iOS/Android native dirs
npx expo run:ios                 # or run:android
```

## Deploy backend

```sh
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

## Devnet wallet funding

```sh
solana airdrop 1 <wallet-address> --url devnet
```

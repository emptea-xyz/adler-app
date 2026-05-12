// Demo / "mocker" mode. When enabled, every read service returns rich
// in-memory fixtures and the Privy → Firebase auth bridge is bypassed
// in favor of a hardcoded demo user. Lets us run the app fully offline
// for pitch demos / screenshots without a real wallet or live backend.
//
// This file is the only switch — every service file branches on
// DEMO_MODE at the top of each public function.

export const DEMO_MODE: boolean =
    (process.env.EXPO_PUBLIC_DEMO_MODE ?? 'true').toLowerCase() === 'true';

/** Stable Privy-style uid for the demo user. */
export const DEMO_USER_ID = 'did:privy:demo-maru';
export const DEMO_USER_EMAIL = 'maru@adler.app';

/** A real-looking base58 Solana address (devnet, unused). */
export const DEMO_WALLET_ADDRESS = 'AdLeRmoCk1nGwAlLeT9aXdEmO11111111111111111';

/** Headline balance shown on the Wallet tab. */
export const DEMO_BALANCE_SOL = 2.847;

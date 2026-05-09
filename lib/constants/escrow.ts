import { PublicKey } from "@solana/web3.js";
import { SOLANA_NETWORK, type SolanaNetwork } from "./featureGates";

// Adler escrow program (`../adler-program`) — devnet deploy. Mainnet
// deploy is gated on external audit + Squads multisig upgrade authority,
// so the mainnet entry below intentionally points at the same address as
// devnet for now. Bump it (and ship a release note) on cutover day.
const PROGRAM_IDS: Record<SolanaNetwork, string> = {
  devnet: "BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr",
  "mainnet-beta": "BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr",
  testnet: "BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr",
};

export const V1_PROGRAM_ID = new PublicKey(PROGRAM_IDS[SOLANA_NETWORK]);

// Sentinel default for surfaces that need to render a deadline before the
// chain has been queried. The real value lives at
// `ProtocolConfig.approval_window_secs` and may diverge if the admin
// rotates it via `update_protocol_field` — never trust this for settlement
// logic. UI countdowns must read the on-chain config or the per-contract
// `escrow.approval_deadline` instead.
export const APPROVAL_WINDOW_SECS_DEFAULT = 72 * 3600;

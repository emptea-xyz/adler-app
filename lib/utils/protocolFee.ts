/**
 * Single source of truth for the Adler protocol fee (0.5%, charged on
 * winner payout at settle_manual_bounty). Mirrors the Rust constant
 * `PROTOCOL_FEE_BPS = 50` in the `adler-escrow` program — changing the
 * value here without also redeploying the program will diverge from the
 * on-chain math.
 */
export const PROTOCOL_FEE_BPS = 50;

export function computeFeeLamports(amountLamports: number): number {
    return Math.floor((amountLamports * PROTOCOL_FEE_BPS) / 10_000);
}

export function computeNetLamports(amountLamports: number): number {
    return amountLamports - computeFeeLamports(amountLamports);
}

export function computeFeeSol(amountLamports: number): number {
    return computeFeeLamports(amountLamports) / 1e9;
}

export function computeNetSol(amountLamports: number): number {
    return computeNetLamports(amountLamports) / 1e9;
}

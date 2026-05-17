import {
    PublicKey,
    SystemProgram,
    Transaction,
} from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { getConnection, solToLamports } from './connection';

export interface TransferSolLamportsInput {
    /** Privy embedded wallet provider (from `wallet.getProvider()`). */
    provider: PrivyEmbeddedSolanaWalletProvider;
    /** Sender's base58 address. */
    fromAddress: string;
    /** Recipient base58 address. */
    toAddress: string;
    /** Integer lamports to transfer (1 SOL = 10^9 lamports). */
    amountLamports: number;
}

/**
 * Build, sign, and send a SOL transfer using a Privy embedded Solana wallet.
 * Takes lamports (integer) directly so callers can do precise math without
 * float rounding ambiguity. Returns the signature once the network has
 * accepted it (Privy polls for inclusion internally — caller may still
 * want `connection.confirmTransaction(signature)` for balance refetch
 * timing).
 */
export async function transferSolLamports({
    provider,
    fromAddress,
    toAddress,
    amountLamports,
}: TransferSolLamportsInput): Promise<string> {
    if (!toAddress) throw new Error('Recipient wallet address is missing');
    if (!Number.isInteger(amountLamports) || amountLamports <= 0) {
        throw new Error('Amount must be a positive integer in lamports');
    }

    const connection = getConnection();
    const fromPubkey = new PublicKey(fromAddress);
    const toPubkey = new PublicKey(toAddress);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const tx = new Transaction({
        feePayer: fromPubkey,
        blockhash,
        lastValidBlockHeight,
    }).add(
        SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: amountLamports,
        }),
    );

    const result = await provider.request({
        method: 'signAndSendTransaction',
        params: {
            transaction: tx,
            connection,
        },
    });

    return result.signature;
}

/**
 * @deprecated Use `transferSolLamports` directly to avoid float rounding.
 * Kept as a thin shim so older callers don't break mid-migration.
 */
export async function transferSol(input: {
    provider: PrivyEmbeddedSolanaWalletProvider;
    fromAddress: string;
    toAddress: string;
    amountSol: number;
}): Promise<string> {
    return transferSolLamports({
        provider: input.provider,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        amountLamports: solToLamports(input.amountSol),
    });
}

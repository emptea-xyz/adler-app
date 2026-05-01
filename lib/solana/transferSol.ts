import {
    PublicKey,
    SystemProgram,
    Transaction,
} from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/js-sdk-core';
import { getConnection, solToLamports } from './connection';

export interface TransferSolInput {
    /** Privy embedded wallet provider (from `wallet.getProvider()`). */
    provider: PrivyEmbeddedSolanaWalletProvider;
    /** Sender's base58 address. */
    fromAddress: string;
    /** Recipient base58 address. */
    toAddress: string;
    /** Amount in SOL (e.g. 0.1). */
    amountSol: number;
}

/**
 * Build, sign, and send a SOL transfer using a Privy embedded Solana wallet.
 * Returns the transaction signature once the network has accepted it (Privy
 * polls for confirmation internally).
 */
export async function transferSol({
    provider,
    fromAddress,
    toAddress,
    amountSol,
}: TransferSolInput): Promise<string> {
    if (!toAddress) throw new Error('Recipient wallet address is missing');
    if (amountSol <= 0) throw new Error('Amount must be positive');

    const connection = getConnection();
    const fromPubkey = new PublicKey(fromAddress);
    const toPubkey = new PublicKey(toAddress);
    const lamports = solToLamports(amountSol);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const tx = new Transaction({
        feePayer: fromPubkey,
        blockhash,
        lastValidBlockHeight,
    }).add(
        SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports,
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

import {
    PublicKey,
    Transaction,
    type TransactionInstruction,
} from '@solana/web3.js';
import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { getConnection } from '@/lib/solana/connection';

export interface EscrowError extends Error {
    code?: string;
    cause?: unknown;
    signature?: string;
}

const ANCHOR_ERROR_CODE_RE = /AnchorError occurred\..*Error Code: (\w+)\.|Error Code: (\w+)\b/;

function parseAnchorErrorCode(err: unknown): string | undefined {
    const message = err instanceof Error ? err.message : String(err);
    const match = ANCHOR_ERROR_CODE_RE.exec(message);
    return match?.[1] ?? match?.[2];
}

function wrapError(err: unknown, signature?: string): EscrowError {
    const base: EscrowError = err instanceof Error
        ? Object.assign(new Error(err.message), { cause: err })
        : Object.assign(new Error(String(err)), { cause: err });
    base.code = parseAnchorErrorCode(err);
    if (signature) base.signature = signature;
    return base;
}

export async function sendIxs(
    provider: PrivyEmbeddedSolanaWalletProvider,
    ixs: TransactionInstruction[],
    feePayer: PublicKey | string,
): Promise<string> {
    const connection = getConnection();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const tx = new Transaction({ blockhash, lastValidBlockHeight }).add(...ixs);
    tx.feePayer = typeof feePayer === 'string' ? new PublicKey(feePayer) : feePayer;

    let signature: string | undefined;
    try {
        const result = await provider.request({
            method: 'signAndSendTransaction',
            params: {
                transaction: tx,
                connection,
            },
        });
        signature = result.signature;
    } catch (err) {
        throw wrapError(err);
    }

    try {
        const txErr = await pollConfirmation(connection, signature, lastValidBlockHeight);
        if (txErr) {
            const logs = await connection
                .getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
                .then((txInfo) => txInfo?.meta?.logMessages?.join('\n') ?? '')
                .catch(() => '');
            throw wrapError(
                new Error(`Transaction failed on-chain: ${JSON.stringify(txErr)}\n${logs}`),
                signature,
            );
        }
    } catch (err) {
        throw wrapError(err, signature);
    }

    return signature;
}

async function pollConfirmation(
    connection: ReturnType<typeof getConnection>,
    signature: string,
    lastValidBlockHeight: number,
): Promise<unknown | null> {
    const intervalMs = 1000;
    const timeoutMs = 60_000;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const { value } = await connection.getSignatureStatuses([signature], {
            searchTransactionHistory: false,
        });
        const status = value[0];
        if (status) {
            if (status.err) return status.err;
            if (
                status.confirmationStatus === 'confirmed' ||
                status.confirmationStatus === 'finalized'
            ) {
                return null;
            }
        } else {
            const currentHeight = await connection.getBlockHeight('confirmed').catch(() => null);
            if (currentHeight !== null && currentHeight > lastValidBlockHeight) {
                throw new Error('Transaction expired before confirmation');
            }
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('Timed out waiting for transaction confirmation');
}

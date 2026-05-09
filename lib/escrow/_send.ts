import {
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
): Promise<string> {
    const connection = getConnection();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const tx = new Transaction({ blockhash, lastValidBlockHeight }).add(...ixs);

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
        const res = await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed',
        );
        if (res.value.err) {
            const logs = await connection
                .getTransaction(signature, { commitment: 'confirmed' })
                .then((txInfo) => txInfo?.meta?.logMessages?.join('\n') ?? '')
                .catch(() => '');
            throw wrapError(
                new Error(`Transaction failed on-chain: ${JSON.stringify(res.value.err)}\n${logs}`),
                signature,
            );
        }
    } catch (err) {
        throw wrapError(err, signature);
    }

    return signature;
}

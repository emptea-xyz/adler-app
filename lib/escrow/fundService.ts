import type { PrivyEmbeddedSolanaWalletProvider } from '@privy-io/expo';
import { transferSol } from '@/lib/solana/transferSol';

export interface FundServiceInput {
    provider: PrivyEmbeddedSolanaWalletProvider;
    fromAddress: string;
    creatorPubkey: string;
    amountSol: number;
}

export async function fundService(input: FundServiceInput): Promise<{ signature: string }> {
    const signature = await transferSol({
        provider: input.provider,
        fromAddress: input.fromAddress,
        toAddress: input.creatorPubkey,
        amountSol: input.amountSol,
    });
    return { signature };
}

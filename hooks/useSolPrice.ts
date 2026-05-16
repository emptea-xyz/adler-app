import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/constants/queryKeys';

const SOL_PRICE_URL =
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';

async function fetchSolPriceUsd(): Promise<number> {
    const res = await fetch(SOL_PRICE_URL);
    if (!res.ok) throw new Error(`SOL price ${res.status}`);
    const json = (await res.json()) as { solana?: { usd?: number } };
    const price = json.solana?.usd;
    if (typeof price !== 'number' || !Number.isFinite(price)) {
        throw new Error('SOL price missing');
    }
    return price;
}

export function useSolPrice() {
    return useQuery({
        queryKey: qk.prices.sol(),
        queryFn: fetchSolPriceUsd,
        refetchInterval: 60_000,
        staleTime: 30_000,
        retry: 1,
    });
}

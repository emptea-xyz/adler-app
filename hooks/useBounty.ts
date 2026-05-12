import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/constants/queryKeys';
import { getBounty } from '@/lib/services/bountyService';

export function useBounty(id: string | null | undefined) {
    return useQuery({
        queryKey: id ? qk.bounties.detail(id) : ['bounties', 'detail', 'noop'],
        queryFn: () => (id ? getBounty(id) : Promise.resolve(null)),
        enabled: Boolean(id),
        staleTime: 15_000,
    });
}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { qk } from '@/lib/constants/queryKeys';
import { listMyMemberships } from '@/lib/services/groupService';

/**
 * Returns a Set of groupIds the signed-in user belongs to, cached for
 * 60s under the canonical memberships query key. Cheap to consume from
 * many components — they share one network round-trip via TanStack Query.
 */
export function useMyGroupIds(): Set<string> {
    const { user } = useAuth();
    const q = useQuery({
        queryKey: user ? qk.groups.myMemberships(user.id) : ['groups', 'myMemberships', 'anon'],
        queryFn: () => (user ? listMyMemberships(user.id) : Promise.resolve([])),
        enabled: !!user,
        staleTime: 60_000,
    });
    return useMemo(
        () => new Set((q.data ?? []).map((m) => m.groupId)),
        [q.data],
    );
}

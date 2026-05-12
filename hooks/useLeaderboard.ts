import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/constants/queryKeys';
import {
    listTop,
    type LeaderboardMetric,
} from '@/lib/services/leaderboardService';

export function useLeaderboard(metric: LeaderboardMetric) {
    return useQuery({
        queryKey: qk.leaderboard.list(metric),
        queryFn: () => listTop(metric),
        staleTime: 60_000,
    });
}

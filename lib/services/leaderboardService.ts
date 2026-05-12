import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Profile } from '@/lib/types/profile';
import { tsMs } from '@/lib/utils/firestoreTimestamp';
import { DEFAULT_LOCATION } from '@/lib/types/profile';
import { DEMO_MODE } from '@/lib/mock';
import { LEADERBOARD_PROFILES } from '@/lib/mock/fixtures';

export type LeaderboardMetric =
    | 'lamportsWonFromBounties'
    | 'bountiesWon'
    | 'bountiesParticipated';

const COLLECTION = 'profiles';

function row(uid: string, data: Record<string, unknown>): Profile {
    return {
        id: uid,
        username: (data.username as string) ?? '',
        displayName: (data.displayName as string) ?? '',
        bio: (data.bio as string) ?? '',
        avatarUrl: (data.avatarUrl as string | null) ?? null,
        walletAddress: (data.walletAddress as string | null) ?? null,
        location:
            (data.location as Profile['location'] | undefined) ?? DEFAULT_LOCATION,
        groupCount: typeof data.groupCount === 'number' ? data.groupCount : 0,
        lamportsWonFromBounties:
            typeof data.lamportsWonFromBounties === 'number'
                ? data.lamportsWonFromBounties
                : 0,
        bountiesWon: typeof data.bountiesWon === 'number' ? data.bountiesWon : 0,
        bountiesParticipated:
            typeof data.bountiesParticipated === 'number' ? data.bountiesParticipated : 0,
        latestActivityAt: tsMs(data.latestActivityAt),
        createdAt: tsMs(data.createdAt) || Date.now(),
        updatedAt: tsMs(data.updatedAt) || Date.now(),
        lastUsernameChangeAt: tsMs(data.lastUsernameChangeAt),
    };
}

export async function listTop(
    metric: LeaderboardMetric,
    max = 100,
): Promise<Profile[]> {
    if (DEMO_MODE) {
        return [...LEADERBOARD_PROFILES]
            .filter((p) => p[metric] > 0)
            .sort((a, b) => b[metric] - a[metric])
            .slice(0, max);
    }
    const snap = await getDocs(
        query(
            collection(db, COLLECTION),
            where(metric, '>', 0),
            orderBy(metric, 'desc'),
            limit(max),
        ),
    );
    return snap.docs.map((d) => row(d.id, d.data() as Record<string, unknown>));
}

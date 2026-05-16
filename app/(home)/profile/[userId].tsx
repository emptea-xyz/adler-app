import React, { useMemo, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { haptic } from '@/lib/utils/haptic';
import {
    BountyCardForBounty,
    BountyCardForSubmission,
} from '@/components/features/bounty/BountyItemCard';
import { qk } from '@/lib/constants/queryKeys';
import { getProfile } from '@/lib/services/profileService';
import { getBounty, listMyPostedBounties } from '@/lib/services/bountyService';
import { listMySubmissions } from '@/lib/services/submissionService';
import type { Bounty } from '@/lib/types/bounty';
import type { Submission } from '@/lib/types/submission';

const TABS = ['Won', 'Created', 'Participated'] as const;
type Tab = (typeof TABS)[number];

/**
 * Public profile route. Every user — and every poster, submitter, winner
 * tapped from anywhere in the app — opens here. Renders their stats and
 * the same Won / Created / Participated tabs as the owner's tab profile.
 */
export default function PublicProfileScreen() {
    const { userId: userIdParam } = useLocalSearchParams<{ userId: string }>();
    const userId = String(userIdParam ?? '');
    const { theme } = useTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [tab, setTab] = useState<Tab>('Won');

    // If a user lands on their own profile route, bounce to the tab so the
    // gear/settings affordance is available without duplicating the UI.
    React.useEffect(() => {
        if (user && userId === user.id) {
            router.replace('/(home)/(tabs)/profile');
        }
    }, [user, userId]);

    const profileQuery = useQuery({
        queryKey: qk.profiles.detail(userId),
        queryFn: () => getProfile(userId),
        enabled: !!userId,
        staleTime: 5 * 60_000,
    });
    const profile = profileQuery.data ?? null;

    const createdQuery = useQuery({
        queryKey: qk.bounties.byPoster(userId),
        enabled: !!userId,
        queryFn: () => listMyPostedBounties(userId),
    });

    const submissionsQuery = useQuery({
        queryKey: qk.submissions.bySubmitter(userId),
        enabled: !!userId,
        queryFn: () => listMySubmissions(userId),
    });

    const submissions = useMemo(() => submissionsQuery.data ?? [], [submissionsQuery.data]);
    const bountyIds = useMemo(
        () =>
            Array.from(
                new Set(
                    submissions
                        .filter((s) => !s.bountyTitle || s.bountyLamports == null || !s.bountyStatus)
                        .map((s) => s.bountyId),
                ),
            ),
        [submissions],
    );

    const bountyQueries = useQueries({
        queries: bountyIds.map((id) => ({
            queryKey: qk.bounties.detail(id),
            queryFn: () => getBounty(id),
            staleTime: 60_000,
        })),
    });

    const bountyById = useMemo(() => {
        const map: Record<string, Bounty | undefined> = {};
        bountyIds.forEach((id, i) => {
            map[id] = bountyQueries[i]?.data ?? undefined;
        });
        return map;
    }, [bountyIds, bountyQueries]);

    const createdCount = createdQuery.data?.length ?? 0;
    const participatedCount = submissions.length;
    const wonCount = useMemo(() => submissions.filter((s) => s.isWinner).length, [submissions]);
    const winRatePct =
        participatedCount > 0 ? Math.round((wonCount / participatedCount) * 100) : null;

    const counts: Record<Tab, number> = {
        Won: wonCount,
        Created: createdCount,
        Participated: participatedCount,
    };

    if (profileQuery.isLoading) {
        return (
            <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
                <ScreenHeader title="Profile" />
                <View style={{ padding: 16, gap: 12 }}>
                    <Skeleton height={120} />
                    <Skeleton height={80} />
                </View>
            </ThemedView>
        );
    }

    if (!profile) {
        return (
            <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
                <ScreenHeader title="Profile" />
                <View style={{ padding: 24, alignItems: 'center', marginTop: 80 }}>
                    <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                        Profile not found
                    </ThemedText>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
            <ScreenHeader title={`@${profile.username}`} />

            <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 + insets.bottom }}>
                <View style={{ alignItems: 'center', paddingHorizontal: 24, gap: 12 }}>
                    <Avatar
                        size="xl"
                        avatarUrl={profile.avatarUrl}
                        initial={profile.displayName.charAt(0)}
                    />
                    <View style={{ alignItems: 'center' }}>
                        <ThemedText type="h3" style={{ color: theme[950], textAlign: 'center' }}>
                            {profile.displayName}
                        </ThemedText>
                        <ThemedText
                            type="body-sm"
                            style={{ color: theme[300], textAlign: 'center' }}
                        >
                            @{profile.username}
                        </ThemedText>
                    </View>
                    {profile.bio ? (
                        <ThemedText
                            type="body-sm"
                            style={{ color: theme[500], textAlign: 'center' }}
                            numberOfLines={3}
                        >
                            {profile.bio}
                        </ThemedText>
                    ) : null}
                </View>

                <View style={{ marginTop: 20, paddingHorizontal: 24 }}>
                    <WinRateBlock
                        winRatePct={winRatePct}
                        wonCount={wonCount}
                        participatedCount={participatedCount}
                    />
                </View>

                <View style={{ marginTop: 20 }}>
                    <FullWidthUnderlineTabs
                        tabs={TABS}
                        active={tab}
                        onChange={setTab}
                        counts={counts}
                    />
                </View>

                <View>
                    <BountyList
                        tab={tab}
                        createdData={createdQuery.data}
                        submissions={submissions}
                        bountyById={bountyById}
                    />
                </View>
            </ScrollView>
        </ThemedView>
    );
}

function WinRateBlock({
    winRatePct,
    wonCount,
    participatedCount,
}: {
    winRatePct: number | null;
    wonCount: number;
    participatedCount: number;
}) {
    const { theme } = useTheme();
    return (
        <View style={{ alignItems: 'center', gap: 2 }}>
            <ThemedText type="caption-semibold" style={{ color: theme[400], letterSpacing: 0.6 }}>
                WIN RATE
            </ThemedText>
            <ThemedText type="h1" style={{ color: theme[950] }}>
                {winRatePct == null ? '—' : `${winRatePct}%`}
            </ThemedText>
            <ThemedText type="body-xs" style={{ color: theme[500] }}>
                {wonCount} won · {participatedCount} submitted
            </ThemedText>
        </View>
    );
}

function FullWidthUnderlineTabs<T extends string>({
    tabs,
    active,
    onChange,
    counts,
}: {
    tabs: readonly T[];
    active: T;
    onChange: (t: T) => void;
    counts: Record<T, number>;
}) {
    const { theme } = useTheme();
    return (
        <View style={{ flexDirection: 'row', width: '100%' }}>
            {tabs.map((t) => {
                const isActive = active === t;
                return (
                    <Pressable
                        key={t}
                        onPress={() => {
                            haptic('light');
                            onChange(t);
                        }}
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 6,
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: isActive ? theme[950] : theme[200],
                        }}
                    >
                        <ThemedText
                            type="body-sm-semibold"
                            style={{ color: isActive ? theme[950] : theme[300] }}
                        >
                            {t}
                        </ThemedText>
                        <ThemedText
                            type="body-xs-semibold"
                            style={{ color: isActive ? theme[500] : theme[300] }}
                        >
                            {counts[t]}
                        </ThemedText>
                    </Pressable>
                );
            })}
        </View>
    );
}

function BountyList({
    tab,
    createdData,
    submissions,
    bountyById,
}: {
    tab: Tab;
    createdData: Bounty[] | undefined;
    submissions: Submission[];
    bountyById: Record<string, Bounty | undefined>;
}) {
    if (tab === 'Created') {
        const items = createdData ?? [];
        if (items.length === 0) {
            return <EmptyState title="No bounties posted" description="Nothing here yet." />;
        }
        return (
            <View>
                {items.map((b) => (
                    <BountyCardForBounty key={b.id} bounty={b} />
                ))}
            </View>
        );
    }

    const items = tab === 'Won' ? submissions.filter((s) => s.isWinner) : submissions;
    if (items.length === 0) {
        return (
            <EmptyState
                title={tab === 'Won' ? 'No wins yet' : 'No submissions yet'}
                description="Nothing here yet."
            />
        );
    }
    return (
        <View>
            {items.map((s) => (
                <BountyCardForSubmission
                    key={s.id}
                    submission={s}
                    bounty={bountyById[s.bountyId]}
                />
            ))}
        </View>
    );
}

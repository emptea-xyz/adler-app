import React, { useMemo, useState } from 'react';
import { View, Pressable, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { Avatar } from '@/components/ui/Avatar';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { haptic } from '@/lib/utils/haptic';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Status } from '@/constants/StatusColors';
import {
    BountyCardForBounty,
    BountyCardForSubmission,
} from '@/components/features/bounty/BountyItemCard';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { qk } from '@/lib/constants/queryKeys';
import { getBounty, listMyPostedBounties } from '@/lib/services/bountyService';
import { listMySubmissions } from '@/lib/services/submissionService';
import type { Bounty } from '@/lib/types/bounty';
import type { Submission } from '@/lib/types/submission';

const TABS = ['Won', 'Created', 'Participated'] as const;
type Tab = (typeof TABS)[number];

export default function ProfileScreen() {
    const { theme } = useTheme();
    const { profile, refreshProfile } = useUser();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<Tab>('Won');

    const createdQuery = useQuery({
        queryKey: user ? qk.bounties.byPoster(user.id) : ['bounties', 'byPoster', 'anon'],
        enabled: !!user,
        queryFn: () => listMyPostedBounties(user!.id),
    });

    const submissionsQuery = useQuery({
        queryKey: user ? qk.submissions.bySubmitter(user.id) : ['submissions', 'bySubmitter', 'anon'],
        enabled: !!user,
        queryFn: () => listMySubmissions(user!.id),
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

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ paddingTop: insets.top }}>
                <AdlerHomeHeader
                    title="Profile"
                    rightSlot={
                        <>
                            <CircleIconButton
                                icon="trophy.fill"
                                onPress={() => router.push('/leaderboard')}
                                accessibilityLabel="Leaderboard"
                            />
                            <CircleIconButton
                                icon="gearshape.fill"
                                onPress={() => router.push('/settings')}
                                accessibilityLabel="Settings"
                            />
                        </>
                    }
                />
            </View>

            {!profile ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Spinner size={32} />
                </View>
            ) : (
            <ScrollView
                contentContainerStyle={{
                    paddingTop: 8,
                    paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={createdQuery.isFetching || submissionsQuery.isFetching}
                        onRefresh={async () => {
                            if (!user) return;
                            await Promise.all([
                                refreshProfile(),
                                queryClient.invalidateQueries({ queryKey: qk.bounties.byPoster(user.id) }),
                                queryClient.invalidateQueries({ queryKey: qk.submissions.bySubmitter(user.id) }),
                            ]);
                        }}
                        tintColor={theme[950]}
                    />
                }
            >
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
                    <WinRateBlock winRatePct={winRatePct} wonCount={wonCount} participatedCount={participatedCount} />
                </View>

                <View style={{ marginTop: 20 }}>
                    <FullWidthUnderlineTabs tabs={TABS} active={tab} onChange={setTab} counts={counts} />
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
            )}
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
    const lostCount = Math.max(participatedCount - wonCount, 0);

    const cells: { value: string; label: string; color: string }[] = [
        { value: String(wonCount), label: 'won', color: Status.success },
        { value: String(lostCount), label: 'lost', color: Status.error },
        {
            value: `${winRatePct ?? 0}%`,
            label: 'win rate',
            color: theme[950],
        },
    ];

    return (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', gap: 16 }}>
            {cells.map((c, i) => (
                <React.Fragment key={c.label}>
                    {i > 0 ? (
                        <View style={{ width: 1, backgroundColor: theme[100] }} />
                    ) : null}
                    <View style={{ alignItems: 'center', gap: 2 }}>
                        <ThemedText type="body-xl-semibold" style={{ color: c.color }}>
                            {c.value}
                        </ThemedText>
                        <ThemedText
                            type="caption-semibold"
                            style={{ color: theme[400], letterSpacing: 0.6 }}
                        >
                            {c.label.toUpperCase()}
                        </ThemedText>
                    </View>
                </React.Fragment>
            ))}
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
            return (
                <EmptyState
                    title="No bounties yet"
                    description="Tap the + button to post your first bounty."
                />
            );
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
                description={
                    tab === 'Won'
                        ? 'Win a bounty to see it here.'
                        : 'Tap a bounty in Browse to submit your first photo.'
                }
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

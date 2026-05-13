import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { LiveActivityTicker } from '@/components/features/home/LiveActivityTicker';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { Pill } from '@/components/ui/Pill';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BountyCardForBounty } from '@/components/features/bounty/BountyItemCard';
import { GroupLogoDot } from '@/components/features/bounty/BountyTags';
import { GroupsSearchSheet } from '@/components/features/groups/GroupsSearchSheet';
import {
    listOpenPublicBounties,
    listGroupBounties,
} from '@/lib/services/bountyService';
import { getGroup, listMyMemberships } from '@/lib/services/groupService';
import { qk } from '@/lib/constants/queryKeys';
import { EMPTY_BROWSE_PUBLIC, EMPTY_BROWSE_GROUPS } from '@/lib/utils/copy';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Bounty } from '@/lib/types/bounty';
import type { Group } from '@/lib/types/group';
import type { ProfileLocation } from '@/lib/types/profile';

type BrowseTab = 'public' | 'groups';

function sortByLocation(bounties: Bounty[], _location: ProfileLocation): Bounty[] {
    return bounties;
}

export default function BrowseScreen() {
    const { theme } = useTheme();
    const { profile } = useUser();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<BrowseTab>('public');
    const [groupsOpen, setGroupsOpen] = useState(false);

    const publicQuery = useQuery({
        queryKey: qk.bounties.listPublic('open'),
        queryFn: () => listOpenPublicBounties(),
        staleTime: 30_000,
        enabled: tab === 'public',
    });

    const membershipsQuery = useQuery({
        queryKey: user ? qk.groups.myMemberships(user.id) : ['groups', 'myMemberships', 'anon'],
        queryFn: () => (user ? listMyMemberships(user.id) : Promise.resolve([])),
        staleTime: 60_000,
        enabled: !!user && tab === 'groups',
    });
    const myGroupIds = (membershipsQuery.data ?? []).map((m) => m.groupId);

    // Fan-out group fetches so the strip above the bounty list can show
    // each membership with its current status. Cheap — getGroup is cached
    // per id under qk.groups.detail.
    const myGroupsQuery = useQuery({
        queryKey: ['groups', 'byIds', [...myGroupIds].sort()],
        queryFn: async () => {
            const groups = await Promise.all(myGroupIds.map((id) => getGroup(id)));
            return groups.filter((g): g is Group => !!g);
        },
        staleTime: 60_000,
        enabled: tab === 'groups' && myGroupIds.length > 0,
    });
    const myGroups = myGroupsQuery.data ?? [];

    const groupsQuery = useQuery({
        queryKey: qk.bounties.listGroup(myGroupIds, 'open'),
        queryFn: () => listGroupBounties(myGroupIds),
        staleTime: 30_000,
        enabled: tab === 'groups' && myGroupIds.length > 0,
    });

    const isLoading = tab === 'public' ? publicQuery.isLoading : (membershipsQuery.isLoading || groupsQuery.isLoading);
    const dataRaw = tab === 'public' ? publicQuery.data ?? [] : groupsQuery.data ?? [];
    const data = profile ? sortByLocation(dataRaw, profile.location) : dataRaw;

    const onRefresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: qk.bounties.all() }),
            queryClient.invalidateQueries({ queryKey: ['groups'] }),
        ]);
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ paddingTop: insets.top }}>
                <AdlerHomeHeader
                    title="Browse"
                    rightSlot={
                        <CircleIconButton
                            icon="person.2.fill"
                            onPress={() => setGroupsOpen(true)}
                            accessibilityLabel="Find groups"
                        />
                    }
                />
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                    <SegmentedToggle
                        tabs={['Public', 'My Groups'] as const}
                        activeTab={tab === 'public' ? 'Public' : 'My Groups'}
                        onTabChange={(t) => setTab(t === 'Public' ? 'public' : 'groups')}
                        size="md"
                    />
                </View>
            </View>

            <LiveActivityTicker />

            {isLoading ? (
                <View style={{ paddingHorizontal: 16, gap: 12, paddingTop: 8 }}>
                    {[0, 1, 2, 3].map((k) => (
                        <Skeleton key={k} height={84} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <BountyCardForBounty bounty={item} />}
                    contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={
                                tab === 'public' ? publicQuery.isFetching : groupsQuery.isFetching
                            }
                            onRefresh={onRefresh}
                            tintColor={theme[950]}
                        />
                    }
                    ListHeaderComponent={
                        tab === 'groups' && myGroups.length > 0 ? (
                            <MyGroupsStrip groups={myGroups} />
                        ) : null
                    }
                    ListEmptyComponent={
                        tab === 'public' ? (
                            <EmptyState title={EMPTY_BROWSE_PUBLIC.title} description={EMPTY_BROWSE_PUBLIC.description} />
                        ) : (
                            <EmptyState title={EMPTY_BROWSE_GROUPS.title} description={EMPTY_BROWSE_GROUPS.description} />
                        )
                    }
                />
            )}

            <GroupsSearchSheet visible={groupsOpen} onClose={() => setGroupsOpen(false)} />
        </ThemedView>
    );
}

function MyGroupsStrip({ groups }: { groups: Group[] }) {
    const { theme } = useTheme();
    return (
        <View style={{ paddingBottom: 12, gap: 8 }}>
            <ThemedText
                type="caption-semibold"
                style={{
                    color: theme[500],
                    letterSpacing: 0.6,
                    paddingHorizontal: 16,
                }}
            >
                YOUR GROUPS
            </ThemedText>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            >
                {groups.map((g) => (
                    <Pressable
                        key={g.id}
                        onPress={() => {
                            haptic('light');
                            router.push(`/(home)/group/${g.id}`);
                        }}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: theme[200],
                            backgroundColor: theme[50],
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${g.name}`}
                    >
                        <GroupLogoDot name={g.name} logoUrl={g.logoUrl ?? null} size={20} />
                        <ThemedText
                            type="caption-semibold"
                            style={{ color: theme[950] }}
                            numberOfLines={1}
                        >
                            {g.name}
                        </ThemedText>
                        {g.status === 'pending' ? <Pill intent="warning" label="PENDING" icon="clock.fill" /> : null}
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}

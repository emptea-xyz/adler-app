import React, { useState } from 'react';
import { FlatList, View, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/base/ThemedView';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BountyRow } from '@/components/features/bounty/BountyRow';
import {
    listOpenPublicBounties,
    listGroupBounties,
} from '@/lib/services/bountyService';
import { listMyMemberships } from '@/lib/services/groupService';
import { qk } from '@/lib/constants/queryKeys';
import { EMPTY_BROWSE_PUBLIC, EMPTY_BROWSE_GROUPS } from '@/lib/utils/copy';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Bounty } from '@/lib/types/bounty';
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
                <AdlerHomeHeader title="Browse" />
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                    <SegmentedToggle
                        tabs={['Public', 'My Groups'] as const}
                        activeTab={tab === 'public' ? 'Public' : 'My Groups'}
                        onTabChange={(t) => setTab(t === 'Public' ? 'public' : 'groups')}
                        size="md"
                    />
                </View>
            </View>

            {isLoading ? (
                <View style={{ paddingHorizontal: 16, gap: 12, paddingTop: 8 }}>
                    {[0, 1, 2, 3].map((k) => (
                        <Skeleton key={k} height={84} radius={12} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <BountyRow bounty={item} />}
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
                    ListEmptyComponent={
                        tab === 'public' ? (
                            <EmptyState title={EMPTY_BROWSE_PUBLIC.title} description={EMPTY_BROWSE_PUBLIC.description} />
                        ) : (
                            <EmptyState title={EMPTY_BROWSE_GROUPS.title} description={EMPTY_BROWSE_GROUPS.description} />
                        )
                    }
                />
            )}
        </ThemedView>
    );
}

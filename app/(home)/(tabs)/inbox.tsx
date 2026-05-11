import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/base/ThemedView';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
    BountyCardForBounty,
    BountyCardForSubmission,
} from '@/components/features/bounty/BountyItemCard';
import { getBounty, listMyPostedBounties } from '@/lib/services/bountyService';
import { listMySubmissions } from '@/lib/services/submissionService';
import { qk } from '@/lib/constants/queryKeys';
import { EMPTY_INBOX_POSTED, EMPTY_INBOX_SUBMITTED } from '@/lib/utils/copy';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import type { Bounty } from '@/lib/types/bounty';

type InboxTab = 'posted' | 'submitted';

export default function InboxScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [tab, setTab] = useState<InboxTab>('posted');

    const postedQuery = useQuery({
        queryKey: user ? qk.bounties.byPoster(user.id) : ['bounties', 'byPoster', 'anon'],
        queryFn: () => (user ? listMyPostedBounties(user.id) : Promise.resolve([])),
        staleTime: 30_000,
        enabled: !!user && tab === 'posted',
    });

    const submittedQuery = useQuery({
        queryKey: user ? qk.submissions.bySubmitter(user.id) : ['submissions', 'bySubmitter', 'anon'],
        queryFn: () => (user ? listMySubmissions(user.id) : Promise.resolve([])),
        staleTime: 30_000,
        enabled: !!user && tab === 'submitted',
    });

    const submissions = submittedQuery.data ?? [];
    const submissionBountyIds = useMemo(
        () => Array.from(new Set(submissions.map((s) => s.bountyId))),
        [submissions],
    );

    const bountyQueries = useQueries({
        queries: submissionBountyIds.map((id) => ({
            queryKey: qk.bounties.detail(id),
            queryFn: () => getBounty(id),
            staleTime: 60_000,
        })),
    });

    const bountyById = useMemo(() => {
        const map: Record<string, Bounty | undefined> = {};
        submissionBountyIds.forEach((id, i) => {
            map[id] = bountyQueries[i]?.data ?? undefined;
        });
        return map;
    }, [submissionBountyIds, bountyQueries]);

    const loading = tab === 'posted' ? postedQuery.isLoading : submittedQuery.isLoading;

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ paddingTop: insets.top }}>
                <AdlerHomeHeader title="Inbox" />
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                    <SegmentedToggle
                        tabs={['Posted', 'Submitted'] as const}
                        activeTab={tab === 'posted' ? 'Posted' : 'Submitted'}
                        onTabChange={(t) => setTab(t === 'Posted' ? 'posted' : 'submitted')}
                        size="md"
                    />
                </View>
            </View>

            {loading ? (
                <View style={{ paddingHorizontal: 16, gap: 12, paddingTop: 8 }}>
                    {[0, 1, 2].map((k) => (
                        <Skeleton key={k} height={100} />
                    ))}
                </View>
            ) : tab === 'posted' ? (
                <FlatList
                    data={postedQuery.data ?? []}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <BountyCardForBounty bounty={item} />}
                    contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
                    ListEmptyComponent={
                        <EmptyState title={EMPTY_INBOX_POSTED.title} description={EMPTY_INBOX_POSTED.description} />
                    }
                />
            ) : (
                <FlatList
                    data={submissions}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <BountyCardForSubmission
                            submission={item}
                            bounty={bountyById[item.bountyId]}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
                    ListEmptyComponent={
                        <EmptyState title={EMPTY_INBOX_SUBMITTED.title} description={EMPTY_INBOX_SUBMITTED.description} />
                    }
                />
            )}
        </ThemedView>
    );
}

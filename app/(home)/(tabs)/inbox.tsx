import React, { useState } from 'react';
import { FlatList, View, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BountyRow } from '@/components/features/bounty/BountyRow';
import Card from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { listMyPostedBounties } from '@/lib/services/bountyService';
import { listMySubmissions } from '@/lib/services/submissionService';
import { qk } from '@/lib/constants/queryKeys';
import { EMPTY_INBOX_POSTED, EMPTY_INBOX_SUBMITTED } from '@/lib/utils/copy';
import { formatRelative } from '@/lib/utils/dates';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import type { Submission } from '@/lib/types/submission';

type InboxTab = 'posted' | 'submitted';

function SubmissionRow({ submission }: { submission: Submission }) {
    const { theme } = useTheme();
    const onPress = () => {
        haptic('light');
        router.push(`/bounty/${submission.bountyId}`);
    };
    let intent: 'lime' | 'orange' | 'cyan' | 'neutral' = 'neutral';
    let label = 'Pending';
    if (submission.isWinner) {
        intent = 'cyan';
        label = 'WON';
    } else if (submission.aiVerdict === 'pass') {
        intent = 'lime';
        label = 'PASS';
    } else if (submission.aiVerdict === 'fail') {
        intent = 'orange';
        label = 'FAIL';
    }
    return (
        <Pressable onPress={onPress}>
            <Card variant="border-bottom">
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, gap: 4 }}>
                        <ThemedText type="body-md-semibold" style={{ color: theme[950] }} numberOfLines={1}>
                            Submission · {formatRelative(submission.submittedAt)}
                        </ThemedText>
                        {submission.aiReasoning ? (
                            <ThemedText type="caption" style={{ color: theme[500] }} numberOfLines={2}>
                                {submission.aiReasoning}
                            </ThemedText>
                        ) : null}
                    </View>
                    <Pill intent={intent} label={label} />
                </View>
            </Card>
        </Pressable>
    );
}

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
                        <Skeleton key={k} height={84} />
                    ))}
                </View>
            ) : tab === 'posted' ? (
                <FlatList
                    data={postedQuery.data ?? []}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <BountyRow bounty={item} />}
                    contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
                    ListEmptyComponent={
                        <EmptyState title={EMPTY_INBOX_POSTED.title} description={EMPTY_INBOX_POSTED.description} />
                    }
                />
            ) : (
                <FlatList
                    data={submittedQuery.data ?? []}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <SubmissionRow submission={item} />}
                    contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
                    ListEmptyComponent={
                        <EmptyState title={EMPTY_INBOX_SUBMITTED.title} description={EMPTY_INBOX_SUBMITTED.description} />
                    }
                />
            )}
        </ThemedView>
    );
}

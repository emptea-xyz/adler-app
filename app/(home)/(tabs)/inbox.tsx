import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
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
import {
    listMyNotifications,
    markNotificationRead,
} from '@/lib/services/notificationsService';
import { qk } from '@/lib/constants/queryKeys';
import { formatRelative } from '@/lib/utils/dates';
import { haptic } from '@/lib/utils/haptic';
import {
    EMPTY_INBOX_POSTED,
    EMPTY_INBOX_SUBMITTED,
    EMPTY_NOTIFICATIONS,
} from '@/lib/utils/copy';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import type { Bounty } from '@/lib/types/bounty';
import type { AdlerNotification } from '@/lib/types/notification';

type InboxTab = 'posted' | 'submitted' | 'activity';

const TAB_LABELS = ['Posted', 'Submitted', 'Activity'] as const;
type TabLabel = (typeof TAB_LABELS)[number];

const tabFromLabel = (label: TabLabel): InboxTab =>
    label === 'Posted' ? 'posted' : label === 'Submitted' ? 'submitted' : 'activity';
const labelFromTab = (tab: InboxTab): TabLabel =>
    tab === 'posted' ? 'Posted' : tab === 'submitted' ? 'Submitted' : 'Activity';

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

    const notificationsQuery = useQuery({
        queryKey: user ? qk.notifications.list(user.id) : ['notifications', 'list', 'anon'],
        queryFn: () => (user ? listMyNotifications(user.id) : Promise.resolve([])),
        staleTime: 15_000,
        enabled: !!user && tab === 'activity',
    });

    const submissions = useMemo(() => submittedQuery.data ?? [], [submittedQuery.data]);
    const submissionBountyIds = useMemo(
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

    const loading =
        tab === 'posted'
            ? postedQuery.isLoading
            : tab === 'submitted'
              ? submittedQuery.isLoading
              : notificationsQuery.isLoading;

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ paddingTop: insets.top }}>
                <AdlerHomeHeader title="Inbox" />
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                    <SegmentedToggle
                        tabs={TAB_LABELS}
                        activeTab={labelFromTab(tab)}
                        onTabChange={(t) => setTab(tabFromLabel(t))}
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
            ) : tab === 'submitted' ? (
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
            ) : (
                <FlatList
                    data={notificationsQuery.data ?? []}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <NotificationRow notification={item} />}
                    contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
                    ListEmptyComponent={
                        <EmptyState title={EMPTY_NOTIFICATIONS.title} description={EMPTY_NOTIFICATIONS.description} />
                    }
                />
            )}
        </ThemedView>
    );
}

function NotificationRow({ notification }: { notification: AdlerNotification }) {
    const { theme } = useTheme();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const onPress = async () => {
        haptic('light');
        if (!notification.read) {
            try {
                await markNotificationRead(notification.id);
                if (user) {
                    queryClient.setQueryData<AdlerNotification[]>(
                        qk.notifications.list(user.id),
                        (prev) =>
                            prev?.map((n) =>
                                n.id === notification.id ? { ...n, read: true } : n,
                            ) ?? prev,
                    );
                }
            } catch {
                // Non-fatal — read flag will reconcile on next fetch.
            }
        }
        if (notification.href) {
            router.push(notification.href as never);
        }
    };

    return (
        <Pressable
            onPress={onPress}
            style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
                borderBottomWidth: 1,
                borderBottomColor: theme[100],
                backgroundColor: notification.read ? 'transparent' : theme[100],
            }}
            accessibilityRole="button"
            accessibilityLabel={notification.title}
        >
            <View
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    marginTop: 6,
                    backgroundColor: notification.read ? 'transparent' : theme[950],
                }}
            />
            <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="body-sm-semibold">{notification.title}</ThemedText>
                {notification.body ? (
                    <ThemedText type="body-sm" style={{ color: theme[600] }}>
                        {notification.body}
                    </ThemedText>
                ) : null}
                <ThemedText type="caption" style={{ color: theme[500], marginTop: 4 }}>
                    {formatRelative(notification.createdAt)}
                </ThemedText>
            </View>
        </Pressable>
    );
}

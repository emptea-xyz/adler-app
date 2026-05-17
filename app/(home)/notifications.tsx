import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { qk } from '@/lib/constants/queryKeys';
import {
    listMyNotifications,
    markAllRead,
    markNotificationRead,
    type NotificationsPage,
} from '@/lib/services/notificationsService';
import type { AdlerNotification } from '@/lib/types/notification';
import { formatRelative } from '@/lib/utils/dates';
import { toast } from '@/lib/utils/toast';

function destinationForNotification(n: AdlerNotification): string {
    const href = n.href?.trim();
    if (!href) return '/(home)/(tabs)/inbox';
    return href.startsWith('/') ? href : `/${href}`;
}

export default function NotificationsScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { theme } = useTheme();
    const [markingAll, setMarkingAll] = useState(false);
    const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});

    const notificationsQuery = useInfiniteQuery<NotificationsPage>({
        queryKey: user ? qk.notifications.list(user.id) : ['notifications', 'list', 'anon'],
        enabled: !!user,
        initialPageParam: null as QueryDocumentSnapshot | null,
        queryFn: ({ pageParam }) =>
            listMyNotifications(user!.id, pageParam as QueryDocumentSnapshot | null),
        getNextPageParam: (last) => last.nextCursor ?? undefined,
    });

    const notifications = useMemo(
        () => (notificationsQuery.data?.pages ?? []).flatMap((p) => p.items),
        [notificationsQuery.data],
    );
    const unreadCount = notifications.filter((n) => !n.read).length;

    const onOpenRow = async (item: AdlerNotification) => {
        // Optimistic read-flag flip so the row updates instantly. The
        // network call backfills the same state; we invalidate the unread
        // counter separately so the inbox-tab badge follows.
        if (!item.read && user) {
            queryClient.setQueryData(
                qk.notifications.list(user.id),
                (data: { pages: NotificationsPage[] } | undefined) =>
                    data
                        ? {
                              ...data,
                              pages: data.pages.map((p) => ({
                                  ...p,
                                  items: p.items.map((n) =>
                                      n.id === item.id ? { ...n, read: true } : n,
                                  ),
                              })),
                          }
                        : data,
            );
        }
        try {
            if (!item.read) {
                setRowBusy((old) => ({ ...old, [item.id]: true }));
                await markNotificationRead(item.id);
                if (user) {
                    queryClient.invalidateQueries({
                        queryKey: [...qk.notifications.list(user.id), 'unread'],
                    });
                }
            }
            router.push(destinationForNotification(item) as any);
        } catch (err: any) {
            toast.error(err?.message ?? 'Could not open notification');
        } finally {
            setRowBusy((old) => ({ ...old, [item.id]: false }));
        }
    };

    const onMarkAll = async () => {
        if (!user || unreadCount < 1 || markingAll) return;
        setMarkingAll(true);
        // Optimistic flip on every cached page.
        queryClient.setQueryData(
            qk.notifications.list(user.id),
            (data: { pages: NotificationsPage[] } | undefined) =>
                data
                    ? {
                          ...data,
                          pages: data.pages.map((p) => ({
                              ...p,
                              items: p.items.map((n) => ({ ...n, read: true })),
                          })),
                      }
                    : data,
        );
        try {
            await markAllRead(notifications);
            await queryClient.invalidateQueries({
                queryKey: [...qk.notifications.list(user.id), 'unread'],
            });
        } catch (err: any) {
            toast.error(err?.message ?? 'Could not mark all read');
            // Re-fetch to reconcile the optimistic state on error.
            queryClient.invalidateQueries({
                queryKey: qk.notifications.list(user.id),
            });
        } finally {
            setMarkingAll(false);
        }
    };

    const onEndReached = () => {
        if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
            notificationsQuery.fetchNextPage();
        }
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader
                    title="Notifications"
                    onBack={() => router.back()}
                    actionButton={
                        unreadCount > 0
                            ? {
                                  icon: 'checkmark.circle.fill',
                                  onPress: onMarkAll,
                                  accessibilityLabel: 'Mark all read',
                              }
                            : undefined
                    }
                />

                {notificationsQuery.isLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={theme[950]} />
                    </View>
                ) : (
                    <FlatList
                        data={notifications}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{
                            paddingHorizontal: 8,
                            paddingTop: 12,
                            paddingBottom: 32,
                            gap: 10,
                        }}
                        refreshControl={
                            <RefreshControl
                                refreshing={notificationsQuery.isRefetching}
                                onRefresh={() => notificationsQuery.refetch()}
                                tintColor={theme[500]}
                            />
                        }
                        onEndReached={onEndReached}
                        onEndReachedThreshold={0.4}
                        ListFooterComponent={
                            notificationsQuery.isFetchingNextPage ? (
                                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                                    <ActivityIndicator color={theme[500]} />
                                </View>
                            ) : null
                        }
                        ListEmptyComponent={
                            <View className="pt-12 items-center">
                                <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                    No notifications yet.
                                </ThemedText>
                            </View>
                        }
                        renderItem={({ item }) => {
                            const unread = !item.read;
                            return (
                                <Pressable
                                    onPress={() => onOpenRow(item)}
                                    disabled={!!rowBusy[item.id]}
                                    style={{
                                        borderRadius: 12,
                                        backgroundColor: unread ? theme[100] : theme[50],
                                        borderWidth: 1,
                                        borderColor: unread ? theme[300] : theme[200],
                                        padding: 14,
                                        gap: 6,
                                        opacity: rowBusy[item.id] ? 0.7 : 1,
                                    }}
                                >
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <ThemedText type="body-sm-semibold">
                                            {item.title}
                                        </ThemedText>
                                        <ThemedText type="caption" style={{ color: theme[500] }}>
                                            {formatRelative(item.createdAt)}
                                        </ThemedText>
                                    </View>
                                    <ThemedText type="body-sm" style={{ color: theme[700] }}>
                                        {item.body}
                                    </ThemedText>
                                    {unread ? (
                                        <ThemedText type="caption-semibold" style={{ color: theme[950] }}>
                                            New
                                        </ThemedText>
                                    ) : null}
                                </Pressable>
                            );
                        }}
                    />
                )}
            </SafeAreaView>
        </ThemedView>
    );
}

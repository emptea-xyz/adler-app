import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react-native';
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

    const notificationsQuery = useQuery({
        queryKey: user ? qk.notifications.list(user.id) : ['notifications', 'list', 'anon'],
        enabled: !!user,
        queryFn: () => listMyNotifications(user!.id),
    });

    const notifications = notificationsQuery.data ?? [];
    const unreadCount = notifications.filter((n) => !n.read).length;

    const onOpenRow = async (item: AdlerNotification) => {
        try {
            if (!item.read) {
                setRowBusy((old) => ({ ...old, [item.id]: true }));
                await markNotificationRead(item.id);
                if (user) {
                    queryClient.invalidateQueries({
                        queryKey: qk.notifications.list(user.id),
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
        try {
            await markAllRead(notifications);
            await queryClient.invalidateQueries({
                queryKey: qk.notifications.list(user.id),
            });
        } catch (err: any) {
            toast.error(err?.message ?? 'Could not mark all read');
        } finally {
            setMarkingAll(false);
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
                                  icon: CheckCheck,
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
                            paddingHorizontal: 16,
                            paddingTop: 12,
                            paddingBottom: 32,
                            gap: 10,
                        }}
                        refreshControl={
                            <RefreshControl
                                refreshing={notificationsQuery.isRefetching}
                                onRefresh={notificationsQuery.refetch}
                                tintColor={theme[500]}
                            />
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

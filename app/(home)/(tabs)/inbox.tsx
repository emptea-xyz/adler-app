import React, { useCallback } from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useInboxUnread } from '@/hooks/useInboxUnread';
import { ThemedView } from '@/components/base/ThemedView';
import EmptyState from '@/components/ui/EmptyState';
import { InboxRow } from '@/components/ui/InboxRow';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { qk } from '@/lib/constants/queryKeys';
import { listMyThreads } from '@/lib/services/threadsService';
import { formatRelative } from '@/lib/utils/dates';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import type { Thread } from '@/lib/types/thread';

function rowForThread(thread: Thread, uid: string): { id: string; title: string; subtitle: string; href: string } {
    const counterpartyId = thread.participants.find((id) => id !== uid) ?? thread.participants[0] ?? uid;
    const snapshot = thread.participantSnapshots[counterpartyId];
    const name = snapshot?.displayName ?? (snapshot?.handle ? `@${snapshot.handle}` : 'Conversation');
    const unread = thread.unreadCount[uid] ?? 0;
    const badge = unread > 0 ? ` (${unread})` : '';
    const prefix = thread.kind === 'order' ? 'Order' : 'Application';
    const preview = thread.lastMessagePreview?.trim() || 'No messages yet';
    return {
        id: thread.id,
        title: `${name}${badge}`,
        subtitle: `${prefix} · ${preview} · ${formatRelative(thread.lastMessageAt || thread.updatedAt)}`,
        href: `/inbox/${thread.id}`,
    };
}

export default function InboxScreen() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const router = useRouter();
    const { markSeen } = useInboxUnread();

    useFocusEffect(
        useCallback(() => {
            markSeen().catch(() => null);
        }, [markSeen]),
    );

    const threadsQuery = useQuery({
        queryKey: user ? qk.threads.byParticipant(user.id) : ['threads', 'byParticipant', 'anon'],
        enabled: !!user,
        queryFn: () => listMyThreads(user!.id),
    });

    const rows = (threadsQuery.data ?? []).map((thread) => rowForThread(thread, user?.id ?? ''));

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <AdlerHomeHeader title="Inbox" />

                {threadsQuery.isLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={theme[950]} />
                    </View>
                ) : (
                    <FlatList
                        data={rows}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{
                            paddingHorizontal: 16,
                            paddingTop: 16,
                            paddingBottom: TAB_BAR_HEIGHT + 32,
                            gap: 16,
                        }}
                        refreshControl={
                            <RefreshControl
                                refreshing={threadsQuery.isRefetching}
                                onRefresh={threadsQuery.refetch}
                                tintColor={theme[500]}
                            />
                        }
                        ListEmptyComponent={
                            <View className="pt-12">
                                <EmptyState
                                    title="No threads yet"
                                    description="Apply to a gig or complete a purchase to open a conversation."
                                />
                            </View>
                        }
                        renderItem={({ item }) => (
                            <InboxRow
                                title={item.title}
                                subline={item.subtitle}
                                onPress={() => router.push(item.href as any)}
                            />
                        )}
                    />
                )}
            </SafeAreaView>
        </ThemedView>
    );
}

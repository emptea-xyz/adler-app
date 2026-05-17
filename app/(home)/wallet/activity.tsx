import React, { useCallback, useMemo } from 'react';
import { FlatList, View, Linking, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { PublicKey } from '@solana/web3.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getConnection, explorerTxUrl } from '@/lib/solana/connection';
import { qk } from '@/lib/constants/queryKeys';
import { formatRelative } from '@/lib/utils/dates';
import { EMPTY_WALLET_ACTIVITY } from '@/lib/utils/copy';
import { haptic } from '@/lib/utils/haptic';

interface ActivityItem {
    signature: string;
    blockTimeMs: number | null;
    success: boolean;
}

interface ActivityPage {
    items: ActivityItem[];
    nextBefore: string | null;
}

const PAGE_LIMIT = 25;

export default function WalletActivityScreen() {
    const { theme } = useTheme();
    const { walletAddress } = useAuth();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const activityQuery = useInfiniteQuery<ActivityPage>({
        queryKey: walletAddress ? qk.wallet.activity(walletAddress) : qk.wallet.activity(null),
        enabled: !!walletAddress,
        initialPageParam: undefined as string | undefined,
        queryFn: async ({ pageParam }) => {
            if (!walletAddress) return { items: [], nextBefore: null };
            const sigs = await getConnection().getSignaturesForAddress(
                new PublicKey(walletAddress),
                { limit: PAGE_LIMIT, before: pageParam as string | undefined },
            );
            const items: ActivityItem[] = sigs.map((s) => ({
                signature: s.signature,
                blockTimeMs: s.blockTime ? s.blockTime * 1000 : null,
                success: !s.err,
            }));
            // Solana's getSignaturesForAddress returns up to `limit`; when
            // the page is short we've reached the tail of history.
            const nextBefore =
                items.length === PAGE_LIMIT ? items[items.length - 1].signature : null;
            return { items, nextBefore };
        },
        getNextPageParam: (last) => last.nextBefore ?? undefined,
        staleTime: 30_000,
    });

    const items = useMemo(
        () => (activityQuery.data?.pages ?? []).flatMap((p) => p.items),
        [activityQuery.data],
    );

    // Refetch on focus so the user sees the latest tx without having to
    // pull. `staleTime: 30_000` keeps the call cheap.
    useFocusEffect(
        useCallback(() => {
            if (!walletAddress) return;
            queryClient.invalidateQueries({ queryKey: qk.wallet.activity(walletAddress) });
        }, [queryClient, walletAddress]),
    );

    const onRefresh = () => {
        if (!walletAddress) return;
        haptic('light');
        queryClient.invalidateQueries({ queryKey: qk.wallet.activity(walletAddress) });
    };

    const onEndReached = () => {
        if (activityQuery.hasNextPage && !activityQuery.isFetchingNextPage) {
            activityQuery.fetchNextPage();
        }
    };

    const openTx = (signature: string) => {
        haptic('light');
        Linking.openURL(explorerTxUrl(signature));
    };

    const renderItem = ({ item }: { item: ActivityItem }) => (
        <Pressable
            onPress={() => openTx(item.signature)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: theme[100],
                }}
            >
                <View
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: theme[100],
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Icon
                        name={item.success ? 'arrow.left.arrow.right' : 'exclamationmark.triangle'}
                        size={16}
                        color={theme[700]}
                    />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText type="body-md-semibold" style={{ color: theme[950] }} numberOfLines={1}>
                        {item.signature.slice(0, 8)}…{item.signature.slice(-8)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme[500] }}>
                        {item.blockTimeMs ? formatRelative(item.blockTimeMs) : 'pending'}
                        {!item.success ? ' · failed' : ''}
                    </ThemedText>
                </View>
                <Icon name="chevron.right" size={14} color={theme[400]} />
            </View>
        </Pressable>
    );

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ paddingTop: insets.top }}>
                <ScreenHeader title="Activity" />
            </View>

            {activityQuery.isLoading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={theme[500]} />
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.signature}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl
                            refreshing={activityQuery.isRefetching}
                            onRefresh={onRefresh}
                            tintColor={theme[500]}
                        />
                    }
                    onEndReached={onEndReached}
                    onEndReachedThreshold={0.4}
                    ListFooterComponent={
                        activityQuery.isFetchingNextPage ? (
                            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                                <ActivityIndicator color={theme[500]} />
                            </View>
                        ) : null
                    }
                    contentContainerStyle={
                        items.length === 0
                            ? { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }
                            : { paddingBottom: insets.bottom + 24 }
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', gap: 6 }}>
                            <ThemedText type="body-lg-semibold" style={{ color: theme[950], textAlign: 'center' }}>
                                {EMPTY_WALLET_ACTIVITY.title}
                            </ThemedText>
                            <ThemedText type="body-md" style={{ color: theme[500], textAlign: 'center' }}>
                                {EMPTY_WALLET_ACTIVITY.description}
                            </ThemedText>
                        </View>
                    }
                />
            )}
        </ThemedView>
    );
}

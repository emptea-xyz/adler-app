import React from 'react';
import { FlatList, View, Linking, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { DEMO_MODE } from '@/lib/mock';
import { MOCK_WALLET_ACTIVITY } from '@/lib/mock/fixtures';

interface ActivityItem {
    signature: string;
    blockTimeMs: number | null;
    success: boolean;
}

const PAGE_LIMIT = 25;

export default function WalletActivityScreen() {
    const { theme } = useTheme();
    const { walletAddress } = useAuth();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const activityQuery = useQuery<ActivityItem[]>({
        queryKey: walletAddress ? qk.wallet.activity(walletAddress) : qk.wallet.activity(null),
        enabled: !!walletAddress,
        queryFn: async () => {
            if (DEMO_MODE) return MOCK_WALLET_ACTIVITY;
            if (!walletAddress) return [];
            const sigs = await getConnection().getSignaturesForAddress(
                new PublicKey(walletAddress),
                { limit: PAGE_LIMIT },
            );
            return sigs.map((s) => ({
                signature: s.signature,
                blockTimeMs: s.blockTime ? s.blockTime * 1000 : null,
                success: !s.err,
            }));
        },
        staleTime: 30_000,
    });

    const onRefresh = () => {
        if (!walletAddress) return;
        haptic('light');
        queryClient.invalidateQueries({ queryKey: qk.wallet.activity(walletAddress) });
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
                    paddingHorizontal: 16,
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
                    data={activityQuery.data ?? []}
                    keyExtractor={(item) => item.signature}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl
                            refreshing={activityQuery.isFetching && !activityQuery.isLoading}
                            onRefresh={onRefresh}
                            tintColor={theme[500]}
                        />
                    }
                    contentContainerStyle={
                        (activityQuery.data?.length ?? 0) === 0
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

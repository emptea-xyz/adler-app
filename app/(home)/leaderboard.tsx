import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import type { LeaderboardMetric } from '@/lib/services/leaderboardService';
import { qk } from '@/lib/constants/queryKeys';
import { lamportsToSol } from '@/lib/solana/connection';
import { formatSol } from '@/lib/utils/formatNumber';
import { EMPTY_LEADERBOARD } from '@/lib/utils/copy';
import { haptic } from '@/lib/utils/haptic';
import type { Profile } from '@/lib/types/profile';

const TABS = ['SOL won', 'Wins', 'Submissions'] as const;
type Tab = (typeof TABS)[number];

const METRIC: Record<Tab, LeaderboardMetric> = {
    'SOL won': 'lamportsWonFromBounties',
    Wins: 'bountiesWon',
    Submissions: 'bountiesParticipated',
};

export default function LeaderboardScreen() {
    const { theme } = useTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<Tab>('SOL won');

    const metric = METRIC[tab];
    const q = useLeaderboard(metric);

    const formatMetric = useCallback((p: Profile): string => {
        if (metric === 'lamportsWonFromBounties') {
            return `${formatSol(lamportsToSol(p.lamportsWonFromBounties))} SOL`;
        }
        if (metric === 'bountiesWon') return String(p.bountiesWon);
        return String(p.bountiesParticipated);
    }, [metric]);

    const data = q.data ?? [];
    const meId = user?.id;

    const onRefresh = () => {
        haptic('light');
        queryClient.invalidateQueries({ queryKey: qk.leaderboard.list(metric) });
    };

    const renderItem = useCallback(({ item, index }: { item: Profile; index: number }) => {
        const rank = index + 1;
        const isMe = meId === item.id;
        const isTop3 = rank <= 3;
        return (
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: theme[100],
                    backgroundColor: isMe ? theme[100] : 'transparent',
                }}
            >
                <View style={{ width: 28, alignItems: 'center' }}>
                    <ThemedText
                        type="body-md-semibold"
                        style={{ color: isTop3 ? theme[950] : theme[500] }}
                    >
                        {rank}
                    </ThemedText>
                </View>
                <Avatar
                    avatarUrl={item.avatarUrl}
                    size="sm"
                    initial={item.displayName?.[0] ?? item.username?.[0] ?? '·'}
                />
                <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText
                        type="body-md-semibold"
                        style={{ color: theme[950] }}
                        numberOfLines={1}
                    >
                        {item.displayName || item.username}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme[500] }} numberOfLines={1}>
                        @{item.username}
                    </ThemedText>
                </View>
                <ThemedText
                    type="body-md-semibold"
                    style={{ color: theme[950] }}
                >
                    {formatMetric(item)}
                </ThemedText>
            </View>
        );
    }, [formatMetric, meId, theme]);

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ paddingTop: insets.top }}>
                <ScreenHeader title="Leaderboard" onBack={() => router.back()} />
            </View>
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
                <SegmentedToggle
                    tabs={TABS}
                    activeTab={tab}
                    onTabChange={setTab}
                    size="sm"
                />
            </View>

            {q.isLoading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={theme[500]} />
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl
                            refreshing={q.isFetching && !q.isLoading}
                            onRefresh={onRefresh}
                            tintColor={theme[500]}
                        />
                    }
                    contentContainerStyle={
                        data.length === 0
                            ? {
                                  flexGrow: 1,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  paddingHorizontal: 32,
                              }
                            : { paddingBottom: insets.bottom + 24 }
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', gap: 6 }}>
                            <ThemedText
                                type="body-lg-semibold"
                                style={{ color: theme[950], textAlign: 'center' }}
                            >
                                {EMPTY_LEADERBOARD.title}
                            </ThemedText>
                            <ThemedText
                                type="body-md"
                                style={{ color: theme[500], textAlign: 'center' }}
                            >
                                {EMPTY_LEADERBOARD.description}
                            </ThemedText>
                        </View>
                    }
                />
            )}
        </ThemedView>
    );
}

import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { KPI } from '@/components/ui/KPI';
import { Pill } from '@/components/ui/Pill';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { qk } from '@/lib/constants/queryKeys';
import {
    feeHistoryStats,
    listOrdersAsBuyer,
    listOrdersAsSeller,
} from '@/lib/services/ordersService';
import type { Order } from '@/lib/types/order';
import { formatSol } from '@/lib/utils/formatNumber';

interface SettledRow extends Order {
    role: 'buyer' | 'seller';
}

export default function SettingsBillingScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { theme } = useTheme();

    const buyerQuery = useQuery({
        queryKey: user ? qk.orders.byBuyer(user.id) : ['orders', 'byBuyer', 'anon'],
        enabled: !!user,
        queryFn: () => listOrdersAsBuyer(user!.id),
    });

    const sellerQuery = useQuery({
        queryKey: user ? qk.orders.bySeller(user.id) : ['orders', 'bySeller', 'anon'],
        enabled: !!user,
        queryFn: () => listOrdersAsSeller(user!.id),
    });

    const stats = useMemo(
        () => feeHistoryStats(buyerQuery.data ?? [], sellerQuery.data ?? []),
        [buyerQuery.data, sellerQuery.data],
    );

    const settledRows = useMemo<SettledRow[]>(() => {
        const out: SettledRow[] = [];
        for (const order of buyerQuery.data ?? []) {
            if (order.status === 'complete') out.push({ ...order, role: 'buyer' });
        }
        for (const order of sellerQuery.data ?? []) {
            if (order.status === 'complete') out.push({ ...order, role: 'seller' });
        }
        out.sort((a, b) => b.createdAt - a.createdAt);
        return out.slice(0, 20);
    }, [buyerQuery.data, sellerQuery.data]);

    if (buyerQuery.isLoading || sellerQuery.isLoading) {
        return (
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="Billing" onBack={() => router.back()} />
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={theme[950]} />
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="Billing" onBack={() => router.back()} />
                <FlatList
                    data={settledRows}
                    keyExtractor={(item) => `${item.id}_${item.role}`}
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 16,
                        paddingBottom: 40,
                        gap: 12,
                    }}
                    ListHeaderComponent={
                        <View style={{ gap: 12, marginBottom: 8 }}>
                            <View style={{ borderRadius: 12, backgroundColor: theme[100], padding: 16, gap: 10 }}>
                                <SectionLabel label="Protocol fees" />
                                <KPI size="md" amount={formatSol(stats.totalFeeSol)} unit="SOL" />
                                <ThemedText type="caption" style={{ color: theme[500] }}>
                                    Last 30 days: {formatSol(stats.last30FeeSol)} SOL · Settled contracts: {stats.settledCount}
                                </ThemedText>
                            </View>
                            <View style={{ borderRadius: 12, backgroundColor: theme[100], padding: 16, gap: 6 }}>
                                <SectionLabel label="Settled volume" />
                                <ThemedText type="body-md-semibold">{formatSol(stats.totalContractSol)} SOL</ThemedText>
                            </View>
                            <SectionLabel label="Last 20 settled" />
                        </View>
                    }
                    ListEmptyComponent={
                        <View className="items-center py-12">
                            <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                No settled orders yet.
                            </ThemedText>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => router.push(`/inbox/order_${item.id}`)}
                            style={{
                                borderRadius: 12,
                                backgroundColor: theme[100],
                                padding: 14,
                                gap: 8,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Pill intent={item.role === 'buyer' ? 'pink' : 'cyan'} label={item.role === 'buyer' ? 'Purchase' : 'Sale'} />
                                <ThemedText type="body-sm-semibold">Fee {formatSol(item.feeSol)} SOL</ThemedText>
                            </View>
                            <ThemedText type="body-sm" style={{ color: theme[700] }} numberOfLines={1}>
                                {item.listingTitle ?? item.listingId}
                            </ThemedText>
                        </Pressable>
                    )}
                />
            </SafeAreaView>
        </ThemedView>
    );
}

import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Linking,
    Pressable,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, RefreshCw } from 'lucide-react-native';
import { PublicKey } from '@solana/web3.js';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { SendSheet } from '@/components/features/wallet/SendSheet';
import { ReceiveSheet } from '@/components/features/wallet/ReceiveSheet';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { KPI } from '@/components/ui/KPI';
import { Pill } from '@/components/ui/Pill';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { qk } from '@/lib/constants/queryKeys';
import { IS_DEVNET_LIKE } from '@/lib/constants/featureGates';
import {
    feeHistoryStats,
    listOrdersAsBuyer,
    listOrdersAsSeller,
} from '@/lib/services/ordersService';
import type { Order } from '@/lib/types/order';
import {
    explorerAddressUrl,
    getConnection,
    lamportsToSol,
} from '@/lib/solana/connection';
import { formatSol } from '@/lib/utils/formatNumber';
import { toast } from '@/lib/utils/toast';

type WalletTab = 'Purchases' | 'Sales';

export default function WalletScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { theme } = useTheme();
    const { user, walletAddress } = useAuth();
    const [tab, setTab] = useState<WalletTab>('Purchases');
    const [sendOpen, setSendOpen] = useState(false);
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [airdropping, setAirdropping] = useState(false);

    const balanceQuery = useQuery({
        queryKey: walletAddress ? qk.wallet.balance(walletAddress) : ['wallet', 'balance', 'none'],
        enabled: !!walletAddress,
        queryFn: async () => {
            const lamports = await getConnection().getBalance(new PublicKey(walletAddress!));
            return lamportsToSol(lamports);
        },
        refetchInterval: 30_000,
        staleTime: 15_000,
    });

    const purchasesQuery = useQuery({
        queryKey: user ? qk.orders.byBuyer(user.id) : ['orders', 'byBuyer', 'anon'],
        enabled: !!user,
        queryFn: () => listOrdersAsBuyer(user!.id),
    });

    const salesQuery = useQuery({
        queryKey: user ? qk.orders.bySeller(user.id) : ['orders', 'bySeller', 'anon'],
        enabled: !!user,
        queryFn: () => listOrdersAsSeller(user!.id),
    });

    const activeOrders = useMemo<Order[]>(
        () => (tab === 'Purchases' ? purchasesQuery.data ?? [] : salesQuery.data ?? []),
        [tab, purchasesQuery.data, salesQuery.data],
    );

    const stats = useMemo(
        () => feeHistoryStats(purchasesQuery.data ?? [], salesQuery.data ?? []),
        [purchasesQuery.data, salesQuery.data],
    );

    const refreshBalance = () => {
        if (!walletAddress) return;
        queryClient.invalidateQueries({ queryKey: qk.wallet.balance(walletAddress) });
    };

    const copyAddress = async () => {
        if (!walletAddress) return;
        await Clipboard.setStringAsync(walletAddress);
        toast.success('Address copied');
    };

    const onAirdrop = async () => {
        if (!walletAddress || !IS_DEVNET_LIKE) return;
        setAirdropping(true);
        try {
            const signature = await getConnection().requestAirdrop(new PublicKey(walletAddress), 1_000_000_000);
            await getConnection().confirmTransaction(signature, 'confirmed');
            toast.success(`Airdrop requested · ${signature.slice(0, 8)}…`);
            refreshBalance();
        } catch (err: any) {
            toast.error(err?.message ?? 'Airdrop failed');
        } finally {
            setAirdropping(false);
        }
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="Wallet" onBack={() => router.back()} />
                <FlatList
                    data={activeOrders}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: 32,
                        gap: 12,
                    }}
                    ListHeaderComponent={
                        <View style={{ gap: 12, marginBottom: 4 }}>
                            <View style={{ borderRadius: 12, backgroundColor: theme[100], padding: 16, gap: 10 }}>
                                <SectionLabel label="Balance" />
                                {balanceQuery.isLoading ? (
                                    <ActivityIndicator color={theme[950]} />
                                ) : (
                                    <KPI size="md" amount={formatSol(balanceQuery.data ?? 0)} unit="SOL" />
                                )}
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <Button
                                        title="Send"
                                        size="sm"
                                        onPress={() => setSendOpen(true)}
                                        leftIcon={<ArrowUpRight size={14} color={theme[50]} />}
                                    />
                                    <Button
                                        title="Receive"
                                        size="sm"
                                        variant="secondary"
                                        onPress={() => setReceiveOpen(true)}
                                        leftIcon={<ArrowDownLeft size={14} color={theme[950]} />}
                                    />
                                    <Button
                                        title="Refresh"
                                        size="sm"
                                        variant="secondary"
                                        onPress={refreshBalance}
                                        leftIcon={<RefreshCw size={14} color={theme[950]} />}
                                    />
                                </View>
                                {IS_DEVNET_LIKE ? (
                                    <Button
                                        title="Get test SOL"
                                        size="sm"
                                        variant="secondary"
                                        onPress={onAirdrop}
                                        loading={airdropping}
                                        disabled={airdropping || !walletAddress}
                                    />
                                ) : null}
                            </View>

                            <View style={{ borderRadius: 12, backgroundColor: theme[100], padding: 16, gap: 8 }}>
                                <SectionLabel label="Address" />
                                <ThemedText type="body-sm" numberOfLines={1}>
                                    {walletAddress ?? '—'}
                                </ThemedText>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <Button title="Copy" size="sm" variant="secondary" onPress={copyAddress} />
                                    <Button
                                        title="Explorer"
                                        size="sm"
                                        variant="secondary"
                                        onPress={() => walletAddress && Linking.openURL(explorerAddressUrl(walletAddress))}
                                        leftIcon={<ExternalLink size={14} color={theme[950]} />}
                                        disabled={!walletAddress}
                                    />
                                </View>
                            </View>

                            <View style={{ borderRadius: 12, backgroundColor: theme[100], padding: 16, gap: 8 }}>
                                <SectionLabel label="Activity" />
                                <SegmentedToggle<WalletTab>
                                    tabs={['Purchases', 'Sales']}
                                    activeTab={tab}
                                    onTabChange={setTab}
                                    size="sm"
                                />
                                <ThemedText type="caption" style={{ color: theme[500] }}>
                                    Settled fees total: {formatSol(stats.totalFeeSol)} SOL
                                </ThemedText>
                            </View>
                        </View>
                    }
                    ListEmptyComponent={
                        <View className="items-center py-12">
                            <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                No {tab.toLowerCase()} yet.
                            </ThemedText>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => router.push(`/order/${item.id}`)}
                            style={{
                                borderRadius: 12,
                                backgroundColor: theme[100],
                                padding: 14,
                                gap: 8,
                            }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Pill intent={item.status === 'complete' ? 'lime' : 'neutral'} label={item.status} />
                                <ThemedText type="body-sm-semibold">{formatSol(item.amountSol)} SOL</ThemedText>
                            </View>
                            <ThemedText type="body-sm" numberOfLines={1}>
                                {item.listingTitle ?? item.listingId}
                            </ThemedText>
                        </Pressable>
                    )}
                />
            </SafeAreaView>

            <SendSheet visible={sendOpen} onClose={() => setSendOpen(false)} />
            <ReceiveSheet
                visible={receiveOpen}
                onClose={() => setReceiveOpen(false)}
                walletAddress={walletAddress}
            />
        </ThemedView>
    );
}

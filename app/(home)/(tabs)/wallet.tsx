import React, { useState } from 'react';
import { ScrollView, View, Pressable, Linking, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ActionTile } from '@/components/ui/ActionTile';
import { Spinner } from '@/components/ui/Spinner';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { SendSheet } from '@/components/features/wallet/SendSheet';
import { ReceiveSheet } from '@/components/features/wallet/ReceiveSheet';
import { ConnectivitySheet } from '@/components/features/wallet/ConnectivitySheet';
import { getConnection, lamportsToSol, explorerAddressUrl } from '@/lib/solana/connection';
import { qk } from '@/lib/constants/queryKeys';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { TailwindColors } from '@/constants/TailwindColors';
import { haptic } from '@/lib/utils/haptic';
import { formatSolParts } from '@/lib/utils/formatNumber';
import { EMPTY_WALLET_BALANCE } from '@/lib/utils/copy';
import { DEMO_MODE, DEMO_BALANCE_SOL } from '@/lib/mock';

export default function WalletScreen() {
    const { theme } = useTheme();
    const { walletAddress } = useAuth();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [sendOpen, setSendOpen] = useState(false);
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [connectivityOpen, setConnectivityOpen] = useState(false);

    const balanceQuery = useQuery({
        queryKey: walletAddress ? qk.wallet.balance(walletAddress) : ['wallet', 'balance', 'none'],
        enabled: !!walletAddress,
        queryFn: async () => {
            if (DEMO_MODE) return DEMO_BALANCE_SOL;
            if (!walletAddress) return 0;
            const lamports = await getConnection().getBalance(new PublicKey(walletAddress));
            return lamportsToSol(lamports);
        },
        refetchInterval: 30_000,
        staleTime: 15_000,
    });

    const balance = balanceQuery.data ?? 0;
    const isZero = balance === 0;
    const { whole, decimal } = formatSolParts(balance);

    const refresh = () => {
        if (!walletAddress) return;
        haptic('light');
        queryClient.invalidateQueries({ queryKey: qk.wallet.balance(walletAddress) });
    };

    const openExplorer = () => {
        if (!walletAddress) return;
        Linking.openURL(explorerAddressUrl(walletAddress));
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ paddingTop: insets.top }}>
                <AdlerHomeHeader
                    title="Wallet"
                    rightSlot={
                        <CircleIconButton
                            icon="antenna.radiowaves.left.and.right"
                            onPress={() => setConnectivityOpen(true)}
                            accessibilityLabel="Solana connectivity"
                        />
                    }
                />
            </View>

            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 24,
                    paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
                    gap: 24,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={balanceQuery.isFetching}
                        onRefresh={() => {
                            if (!walletAddress) return;
                            queryClient.invalidateQueries({ queryKey: qk.wallet.balance(walletAddress) });
                        }}
                        tintColor={theme[950]}
                    />
                }
            >
                <View style={{ gap: 4 }}>
                    {balanceQuery.isLoading || balanceQuery.data === undefined ? (
                        <View style={{ height: 56, justifyContent: 'center' }}>
                            <Spinner size={24} />
                        </View>
                    ) : (
                        <Pressable
                            onPress={refresh}
                            disabled={balanceQuery.isFetching}
                            hitSlop={8}
                            style={{ flexDirection: 'row', alignItems: 'baseline' }}
                        >
                            <ThemedText type="h1" style={{ color: theme[950], fontSize: 56, lineHeight: 64 }}>
                                {whole}
                            </ThemedText>
                            <ThemedText type="h1" style={{ color: theme[400], fontSize: 56, lineHeight: 64 }}>
                                .{decimal}
                            </ThemedText>
                            <ThemedText
                                type="body-md-semibold"
                                style={{ color: theme[400], marginLeft: 6 }}
                            >
                                SOL
                            </ThemedText>
                        </Pressable>
                    )}
                </View>

                {isZero && !balanceQuery.isLoading && (
                    <View style={{ alignItems: 'center', gap: 6, paddingHorizontal: 24 }}>
                        <ThemedText type="body-lg-semibold" style={{ color: theme[950], textAlign: 'center' }}>
                            {EMPTY_WALLET_BALANCE.title}
                        </ThemedText>
                        <ThemedText type="body-md" style={{ color: theme[500], textAlign: 'center' }}>
                            {EMPTY_WALLET_BALANCE.description}
                        </ThemedText>
                    </View>
                )}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    <View style={{ flexBasis: '48%', flexGrow: 1 }}>
                        <ActionTile
                            icon="arrow.up"
                            iconBgColor={TailwindColors.sky[500]}
                            iconPosition="bottom-right"
                            title="Send"
                            subtitle="Send SOL"
                            onPress={() => setSendOpen(true)}
                            disabled={!walletAddress}
                        />
                    </View>
                    <View style={{ flexBasis: '48%', flexGrow: 1 }}>
                        <ActionTile
                            icon="clock.arrow.circlepath"
                            iconBgColor={TailwindColors.rose[500]}
                            iconPosition="bottom-left"
                            title="Activity"
                            subtitle="On-chain history"
                            onPress={() => router.push('/wallet/activity')}
                        />
                    </View>
                    <View style={{ flexBasis: '48%', flexGrow: 1 }}>
                        <ActionTile
                            icon="arrow.down"
                            iconBgColor={TailwindColors.emerald[500]}
                            iconPosition="top-right"
                            title="Receive"
                            subtitle="Receive SOL"
                            onPress={() => {
                                haptic('medium');
                                setReceiveOpen(true);
                            }}
                            disabled={!walletAddress}
                        />
                    </View>
                    <View style={{ flexBasis: '48%', flexGrow: 1 }}>
                        <ActionTile
                            icon="arrow.up.right.square"
                            iconBgColor={TailwindColors.yellow[500]}
                            title="Explorer"
                            subtitle="View on-chain"
                            onPress={openExplorer}
                            disabled={!walletAddress}
                        />
                    </View>
                </View>
            </ScrollView>

            <SendSheet visible={sendOpen} onClose={() => setSendOpen(false)} />
            <ReceiveSheet
                visible={receiveOpen}
                onClose={() => setReceiveOpen(false)}
                walletAddress={walletAddress}
            />
            <ConnectivitySheet
                visible={connectivityOpen}
                onClose={() => setConnectivityOpen(false)}
            />
        </ThemedView>
    );
}

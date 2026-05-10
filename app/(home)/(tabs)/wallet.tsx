import React, { useState } from 'react';
import { ScrollView, View, ActivityIndicator, Pressable, Linking } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ActionTile } from '@/components/ui/ActionTile';
import { SendSheet } from '@/components/features/wallet/SendSheet';
import { ReceiveSheet } from '@/components/features/wallet/ReceiveSheet';
import { getConnection, lamportsToSol, explorerAddressUrl } from '@/lib/solana/connection';
import { qk } from '@/lib/constants/queryKeys';
import { SOLANA_NETWORK } from '@/lib/constants/featureGates';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { Accent } from '@/constants/ThemePalettes';
import { Neutral } from '@/constants/NeutralColors';
import { haptic } from '@/lib/utils/haptic';
import { formatSolParts } from '@/lib/utils/formatNumber';
import { EMPTY_WALLET_BALANCE } from '@/lib/utils/copy';

export default function WalletScreen() {
    const { theme } = useTheme();
    const { walletAddress } = useAuth();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [sendOpen, setSendOpen] = useState(false);
    const [receiveOpen, setReceiveOpen] = useState(false);

    const balanceQuery = useQuery({
        queryKey: walletAddress ? qk.wallet.balance(walletAddress) : ['wallet', 'balance', 'none'],
        enabled: !!walletAddress,
        queryFn: async () => {
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

    const openFaucet = () => {
        if (!walletAddress) return;
        Linking.openURL(`https://faucet.solana.com/?address=${walletAddress}`);
    };

    const openExplorer = () => {
        if (!walletAddress) return;
        Linking.openURL(explorerAddressUrl(walletAddress));
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8 }}>
                <ThemedText type="h3" style={{ color: theme[950] }}>
                    Wallet
                </ThemedText>
            </View>

            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 24,
                    paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
                    gap: 24,
                }}
            >
                <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                            Total Balance
                        </ThemedText>
                        <View
                            style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 9999,
                                backgroundColor: theme[100],
                            }}
                        >
                            <ThemedText
                                type="caption-semibold"
                                style={{ color: theme[600], letterSpacing: 0.6, textTransform: 'uppercase' }}
                            >
                                {SOLANA_NETWORK}
                            </ThemedText>
                        </View>
                    </View>

                    {balanceQuery.isLoading || balanceQuery.data === undefined ? (
                        <View style={{ height: 56, justifyContent: 'center' }}>
                            <ActivityIndicator color={theme[500]} />
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

                <View style={{ alignItems: 'center' }}>
                    <Pressable
                        onPress={() => {
                            haptic('medium');
                            setReceiveOpen(true);
                        }}
                        style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            height: 56,
                            paddingHorizontal: 28,
                            borderRadius: 9999,
                            backgroundColor: theme[950],
                            opacity: pressed ? 0.85 : 1,
                        })}
                        accessibilityRole="button"
                        accessibilityLabel="Receive SOL"
                    >
                        <Icon name="arrow.down" size={18} color={theme[50]} weight="semibold" />
                        <ThemedText type="body-lg-semibold" style={{ color: theme[50] }}>
                            Receive
                        </ThemedText>
                    </Pressable>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    <View style={{ flexBasis: '48%', flexGrow: 1 }}>
                        <ActionTile
                            icon="arrow.up"
                            iconBgColor={Accent.cyan}
                            title="Send"
                            subtitle="Send SOL"
                            onPress={() => setSendOpen(true)}
                            disabled={!walletAddress}
                        />
                    </View>
                    <View style={{ flexBasis: '48%', flexGrow: 1 }}>
                        <ActionTile
                            icon="clock.arrow.circlepath"
                            iconBgColor={Accent.pink}
                            title="Activity"
                            subtitle="On-chain history"
                            onPress={() => router.push('/wallet/activity')}
                        />
                    </View>
                    <View style={{ flexBasis: '48%', flexGrow: 1 }}>
                        <ActionTile
                            icon="plus"
                            iconBgColor={Accent.lime}
                            title="Buy SOL"
                            subtitle="Devnet faucet"
                            onPress={openFaucet}
                            disabled={!walletAddress}
                        />
                    </View>
                    <View style={{ flexBasis: '48%', flexGrow: 1 }}>
                        <ActionTile
                            icon="arrow.up.right.square"
                            iconBgColor={Neutral.blackSoft}
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
        </ThemedView>
    );
}

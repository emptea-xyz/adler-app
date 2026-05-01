import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Linking, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ExternalLink, Copy, RefreshCw } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getConnection, lamportsToSol, explorerAddressUrl } from '@/lib/solana/connection';
import { PublicKey } from '@solana/web3.js';
import { SOLANA_NETWORK } from '@/lib/constants/featureGates';
import { toast } from '@/lib/utils/toast';

export default function WalletScreen() {
    const { walletAddress } = useAuth();
    const { theme } = useTheme();
    const router = useRouter();
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!walletAddress) return;
        setLoading(true);
        try {
            const lamports = await getConnection().getBalance(new PublicKey(walletAddress));
            setBalance(lamportsToSol(lamports));
        } catch (err: any) {
            toast.error(err?.message ?? 'Failed to fetch balance');
        } finally {
            setLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const copy = async () => {
        if (!walletAddress) return;
        await Clipboard.setStringAsync(walletAddress);
        toast.success('Address copied');
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="Wallet" onBack={() => router.back()} />

                <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
                    <Card>
                        <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                            BALANCE · {SOLANA_NETWORK.toUpperCase()}
                        </ThemedText>
                        <View className="flex-row items-baseline gap-2 mt-1">
                            <ThemedText type="h2">
                                {balance !== null ? balance.toFixed(4) : '—'}
                            </ThemedText>
                            <ThemedText type="body-md" style={{ color: theme[500] }}>
                                SOL
                            </ThemedText>
                        </View>
                        <Pressable
                            onPress={refresh}
                            className="flex-row items-center gap-2 mt-3"
                            hitSlop={8}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={theme[500]} />
                            ) : (
                                <RefreshCw color={theme[500]} size={14} />
                            )}
                            <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                Refresh
                            </ThemedText>
                        </Pressable>
                    </Card>

                    <Card>
                        <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                            ADDRESS
                        </ThemedText>
                        <ThemedText type="body-sm" className="mt-2 font-mono">
                            {walletAddress ?? '—'}
                        </ThemedText>

                        <View className="flex-row gap-3 mt-4">
                            <Pressable
                                onPress={copy}
                                className="flex-row items-center gap-2"
                                hitSlop={8}
                            >
                                <Copy color={theme[700]} size={14} />
                                <ThemedText type="body-sm-semibold">Copy</ThemedText>
                            </Pressable>
                            <Pressable
                                onPress={() => walletAddress && Linking.openURL(explorerAddressUrl(walletAddress))}
                                className="flex-row items-center gap-2"
                                hitSlop={8}
                            >
                                <ExternalLink color={theme[700]} size={14} />
                                <ThemedText type="body-sm-semibold">Explorer</ThemedText>
                            </Pressable>
                        </View>
                    </Card>

                    <ThemedText type="body-xs" style={{ color: theme[500] }} className="mt-2">
                        On devnet, fund your wallet with the Solana CLI:{'\n'}
                        <ThemedText type="body-xs-semibold" className="font-mono">
                            solana airdrop 1 {walletAddress ?? '<address>'} --url devnet
                        </ThemedText>
                    </ThemedText>
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

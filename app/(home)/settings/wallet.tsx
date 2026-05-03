import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Linking, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ExternalLink, Copy, RefreshCw } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { KPI } from '@/components/ui/KPI';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getConnection, lamportsToSol, explorerAddressUrl } from '@/lib/solana/connection';
import { PublicKey } from '@solana/web3.js';
import { SOLANA_NETWORK } from '@/lib/constants/featureGates';
import { toast } from '@/lib/utils/toast';

function ucfirst(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

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

                <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24, gap: 16 }}>
                    <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                        <SectionLabel label={`Balance · ${ucfirst(SOLANA_NETWORK)}`} />
                        <KPI
                            size="md"
                            amount={balance !== null ? balance.toFixed(4) : '—'}
                            unit="SOL"
                        />
                        <Pressable
                            onPress={refresh}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
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
                    </View>

                    <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                        <SectionLabel label="Address" />
                        <ThemedText type="body-sm" style={{ color: theme[950] }}>
                            {walletAddress ?? '—'}
                        </ThemedText>

                        <View style={{ flexDirection: 'row', gap: 16, paddingTop: 8 }}>
                            <Pressable
                                onPress={copy}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                hitSlop={8}
                            >
                                <Copy color={theme[950]} size={14} />
                                <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
                                    Copy
                                </ThemedText>
                            </Pressable>
                            <Pressable
                                onPress={() =>
                                    walletAddress && Linking.openURL(explorerAddressUrl(walletAddress))
                                }
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                hitSlop={8}
                            >
                                <ExternalLink color={theme[950]} size={14} />
                                <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
                                    Explorer
                                </ThemedText>
                            </Pressable>
                        </View>
                    </View>

                    <ThemedText type="body-xs" style={{ color: theme[500], marginTop: 8 }}>
                        On devnet, fund your wallet with the Solana CLI:{'\n'}
                        <ThemedText type="body-xs-semibold" style={{ color: theme[700] }}>
                            solana airdrop 1 {walletAddress ?? '<address>'} --url devnet
                        </ThemedText>
                    </ThemedText>
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

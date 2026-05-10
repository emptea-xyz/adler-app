import React from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { WalletPill } from '@/components/ui/WalletPill';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { getConnection, lamportsToSol } from '@/lib/solana/connection';
import { qk } from '@/lib/constants/queryKeys';
import { listMyNotifications } from '@/lib/services/notificationsService';
import { formatSol } from '@/lib/utils/formatNumber';

interface AdlerHomeHeaderProps {
    title: string;
    onPressBalance?: () => void;
}

export function AdlerHomeHeader({ title, onPressBalance }: AdlerHomeHeaderProps) {
    const { theme } = useTheme();
    const { walletAddress, user } = useAuth();
    const { openWallet } = useOverlaySheets();

    const balanceQuery = useQuery({
        queryKey: qk.wallet.balance(walletAddress),
        enabled: !!walletAddress,
        queryFn: async () => {
            if (!walletAddress) return 0;
            const lamports = await getConnection().getBalance(new PublicKey(walletAddress));
            return lamportsToSol(lamports);
        },
        refetchInterval: 30_000,
        staleTime: 15_000,
    });

    const balanceText =
        balanceQuery.data === undefined ? '—' : formatSol(balanceQuery.data);

    const notificationsQuery = useQuery({
        queryKey: user ? qk.notifications.list(user.id) : ['notifications', 'list', 'anon'],
        enabled: !!user,
        queryFn: () => listMyNotifications(user!.id),
        staleTime: 15_000,
        refetchInterval: 30_000,
    });
    const unreadCount = (notificationsQuery.data ?? []).filter((n) => !n.read).length;

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: theme[50],
            }}
        >
            <ThemedText
                type="h4"
                style={{ color: theme[950] }}
                numberOfLines={1}
            >
                {title}
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                    onPress={() => router.push('/notifications')}
                    accessibilityRole="button"
                    accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: theme[100],
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Bell size={16} color={theme[950]} />
                    {unreadCount > 0 ? (
                        <View
                            style={{
                                position: 'absolute',
                                top: 3,
                                right: 4,
                                minWidth: 14,
                                height: 14,
                                borderRadius: 7,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: theme[950],
                                paddingHorizontal: 2,
                            }}
                        >
                            <ThemedText type="caption-semibold" style={{ color: theme[50], fontSize: 9 }}>
                                {unreadCount > 9 ? '9+' : String(unreadCount)}
                            </ThemedText>
                        </View>
                    ) : null}
                </Pressable>
                <WalletPill
                    amount={balanceText}
                    loading={balanceQuery.isLoading}
                    onPress={onPressBalance ?? openWallet}
                />
            </View>
        </View>
    );
}

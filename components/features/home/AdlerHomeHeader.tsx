import React from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { getConnection, lamportsToSol } from '@/lib/solana/connection';
import { PROFILE_KEYS } from '@/lib/constants/queryKeys';

/**
 * Top-of-Browse header. Greeting + role chip on the left, live SOL balance
 * pill on the right (top-left F/Z scanning slot for primary identity).
 */
export function AdlerHomeHeader({ onPressBalance }: { onPressBalance?: () => void }) {
    const { theme } = useTheme();
    const { walletAddress } = useAuth();
    const { profile } = useUser();

    const balanceQuery = useQuery({
        queryKey: walletAddress ? PROFILE_KEYS.walletBalance(walletAddress) : ['wallet', 'balance', 'none'],
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
        balanceQuery.data === undefined
            ? '—'
            : balanceQuery.data >= 100
                ? balanceQuery.data.toFixed(0)
                : balanceQuery.data.toFixed(3);

    return (
        <View className="px-screen pt-2 pb-4 flex-row items-start justify-between">
            <View className="flex-1">
                <ThemedText type="h4" numberOfLines={1}>
                    Hello, {profile?.displayName ?? 'there'}.
                </ThemedText>
                <View className="flex-row items-center gap-2 mt-1">
                    <ThemedText type="body-sm" style={{ color: theme[500] }}>
                        @{profile?.username ?? '—'}
                    </ThemedText>
                    <View
                        className="px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: theme[100] }}
                    >
                        <ThemedText
                            type="caption-semibold"
                            style={{ color: theme[700], letterSpacing: 0.5 }}
                        >
                            {profile?.role?.toUpperCase() ?? 'NO ROLE'}
                        </ThemedText>
                    </View>
                </View>
            </View>

            <Pressable
                onPress={onPressBalance}
                disabled={!onPressBalance}
                className="rounded-full px-3 py-2 flex-row items-center gap-1.5"
                style={{ backgroundColor: theme[100] }}
                hitSlop={6}
            >
                {balanceQuery.isLoading ? (
                    <ActivityIndicator size="small" color={theme[500]} />
                ) : (
                    <>
                        <ThemedText type="body-md-semibold">{balanceText}</ThemedText>
                        <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                            SOL
                        </ThemedText>
                    </>
                )}
            </Pressable>
        </View>
    );
}

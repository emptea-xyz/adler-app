import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { ThemedText } from '@/components/base/ThemedText';
import { WalletPill } from '@/components/ui/WalletPill';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { getConnection, lamportsToSol } from '@/lib/solana/connection';
import { PROFILE_KEYS } from '@/lib/constants/queryKeys';
import { formatSol } from '@/lib/utils/formatNumber';

// Figma node 131:133 — top header on tab screens. Static screen label on the
// left, live wallet balance pill on the right. Drops the personalized greeting
// per design. Tapping the balance pill opens the global WalletSheet by
// default; an optional `onPressBalance` overrides that for special cases.

interface AdlerHomeHeaderProps {
    title: string;
    onPressBalance?: () => void;
}

export function AdlerHomeHeader({ title, onPressBalance }: AdlerHomeHeaderProps) {
    const { theme } = useTheme();
    const { walletAddress } = useAuth();
    const { openWallet } = useOverlaySheets();

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
        balanceQuery.data === undefined ? '—' : formatSol(balanceQuery.data);

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
            <WalletPill
                amount={balanceText}
                loading={balanceQuery.isLoading}
                onPress={onPressBalance ?? openWallet}
            />
        </View>
    );
}

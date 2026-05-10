import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/base/ThemedText';
import Card from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { formatSol } from '@/lib/utils/formatNumber';
import { formatRelative } from '@/lib/utils/dates';
import { haptic } from '@/lib/utils/haptic';
import type { Bounty } from '@/lib/types/bounty';

interface BountyRowProps {
    bounty: Bounty;
}

const STATUS_INTENT: Record<Bounty['status'], 'pink' | 'orange' | 'cyan' | 'lime' | 'neutral' | 'dark'> = {
    open: 'lime',
    settled: 'cyan',
    refunded: 'neutral',
    hidden: 'dark',
};

const STATUS_LABEL: Record<Bounty['status'], string> = {
    open: 'OPEN',
    settled: 'SETTLED',
    refunded: 'REFUNDED',
    hidden: 'HIDDEN',
};

export function BountyRow({ bounty }: BountyRowProps) {
    const { theme } = useTheme();
    const onPress = () => {
        haptic('light');
        router.push(`/bounty/${bounty.id}`);
    };
    return (
        <Pressable onPress={onPress}>
            <Card variant="border-bottom">
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                        <ThemedText type="h4" style={{ color: theme[950] }}>
                            {formatSol(bounty.bountyLamports / 1e9)} SOL
                        </ThemedText>
                        <ThemedText type="body-md" style={{ color: theme[800] }} numberOfLines={2}>
                            {bounty.title}
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: theme[500] }}>
                            {bounty.mode === 'auto' ? 'Auto-verified' : 'Poster picks'} · {formatRelative(bounty.createdAt)}
                        </ThemedText>
                    </View>
                    <Pill intent={STATUS_INTENT[bounty.status]} label={STATUS_LABEL[bounty.status]} />
                </View>
            </Card>
        </Pressable>
    );
}

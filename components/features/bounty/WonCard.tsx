import React, { useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/base/ThemedText';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { SolanaIcon } from '@/components/ui/SolanaIcon';
import { ShareWinCard } from '@/components/features/bounty/ShareWinCard';
import { Neutral } from '@/constants/NeutralColors';
import { Status } from '@/constants/StatusColors';
import { Radius } from '@/constants/LayoutConstants';
import { useTheme } from '@/contexts/ThemeContext';
import { captureAndShareWin } from '@/lib/utils/shareWin';
import { explorerTxUrl } from '@/lib/solana/connection';
import { formatSol } from '@/lib/utils/formatNumber';
import { toast } from '@/lib/utils/toast';
import type { Bounty } from '@/lib/types/bounty';
import type { Profile } from '@/lib/types/profile';
import type { View as RNView } from 'react-native';

interface WonCardProps {
    bounty: Bounty;
    winner: Profile | null;
}

export function WonCard({ bounty, winner }: WonCardProps) {
    const { theme, tw } = useTheme();
    const cardRef = useRef<RNView>(null);
    const [state, setState] = useState<'idle' | 'sharing' | 'success'>('idle');
    const amountSol = bounty.bountyLamports / 1e9;
    const isRefunded = bounty.status === 'refunded';

    const idleBg = theme[950];
    const bg = state === 'success' ? Status.success : idleBg;
    const bgStyle = useAnimatedStyle(
        () => ({
            backgroundColor: withTiming(bg, {
                duration: 220,
                easing: Easing.out(Easing.cubic),
            }),
        }),
        [bg],
    );

    const idleOpacity = useSharedValue(1);
    const successOpacity = useSharedValue(0);
    React.useEffect(() => {
        const t = { duration: 200, easing: Easing.out(Easing.cubic) };
        idleOpacity.value = withTiming(state === 'success' ? 0 : 1, t);
        successOpacity.value = withTiming(state === 'success' ? 1 : 0, t);
    }, [state, idleOpacity, successOpacity]);
    const idleStyle = useAnimatedStyle(() => ({ opacity: idleOpacity.value }));
    const successStyle = useAnimatedStyle(() => ({ opacity: successOpacity.value }));

    const onShare = async () => {
        if (state !== 'idle') return;
        setState('sharing');
        try {
            await captureAndShareWin({ ref: cardRef, fileName: `adler-${bounty.id}` });
            setState('success');
            setTimeout(() => setState('idle'), 1600);
        } catch (err) {
            setState('idle');
            const msg = err instanceof Error ? err.message : 'Could not share';
            toast.error(msg);
        }
    };

    return (
        <View style={{ gap: 12 }}>
            <View
                style={{
                    borderRadius: Radius.lg,
                    backgroundColor: theme[50],
                    borderWidth: 1,
                    borderColor: theme[200],
                    padding: 16,
                    gap: 16,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionLabel label={isRefunded ? 'REFUNDED' : 'SETTLED'} />
                    <Icon name="trophy.fill" size={18} color={theme[700]} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {winner ? (
                        <Avatar
                            size="md"
                            avatarUrl={winner.avatarUrl}
                            initial={winner.displayName?.charAt(0) ?? winner.username.charAt(0)}
                        />
                    ) : (
                        <Avatar size="md" initial="?" />
                    )}
                    <View style={{ flex: 1 }}>
                        <ThemedText type="body-md-semibold" style={{ color: theme[950] }} numberOfLines={1}>
                            {winner?.displayName ?? 'Winner'}
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: theme[500] }} numberOfLines={1}>
                            {winner?.username ? `@${winner.username}` : 'awarded'}
                        </ThemedText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ThemedText type="body-lg-semibold" style={{ color: theme[950] }}>
                            {formatSol(amountSol)}
                        </ThemedText>
                        <SolanaIcon size={14} color={theme[950]} />
                    </View>
                </View>

                {!isRefunded ? (
                    <Pressable
                        onPress={state === 'idle' ? onShare : undefined}
                        disabled={state !== 'idle'}
                        accessibilityRole="button"
                        accessibilityLabel="Share win"
                    >
                        <Animated.View
                            style={[
                                {
                                    height: 48,
                                    borderRadius: Radius.full,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    overflow: 'hidden',
                                },
                                bgStyle,
                            ]}
                        >
                            <Animated.View style={[ABSOLUTE_CENTER, idleStyle]}>
                                <Icon
                                    name="square.and.arrow.up"
                                    size={18}
                                    color={Neutral.white}
                                    weight="semibold"
                                />
                                <ThemedText type="body-md-semibold" style={{ color: Neutral.white }}>
                                    {state === 'sharing' ? 'Rendering…' : 'Share win'}
                                </ThemedText>
                            </Animated.View>
                            <Animated.View style={[ABSOLUTE_CENTER, successStyle]}>
                                <Icon name="checkmark" size={18} color={Neutral.white} weight="semibold" />
                                <ThemedText type="body-md-semibold" style={{ color: Neutral.white }}>
                                    Shared
                                </ThemedText>
                            </Animated.View>
                        </Animated.View>
                    </Pressable>
                ) : null}

                {bounty.txSignature ? (
                    <Pressable onPress={() => Linking.openURL(explorerTxUrl(bounty.txSignature!))}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <ThemedText type="caption-semibold" style={{ color: tw.sky[600] }}>
                                View on Solscan
                            </ThemedText>
                            <Icon name="arrow.up.forward" size={11} color={tw.sky[600]} />
                        </View>
                    </Pressable>
                ) : null}
            </View>

            <View
                style={{
                    position: 'absolute',
                    left: -20000,
                    top: 0,
                    width: 1080,
                    height: 1080,
                }}
                pointerEvents="none"
            >
                <ShareWinCard ref={cardRef} bounty={bounty} winner={winner} />
            </View>
        </View>
    );
}

const ABSOLUTE_CENTER = {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
};

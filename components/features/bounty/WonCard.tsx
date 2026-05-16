import React, { useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { SolanaIcon } from '@/components/ui/SolanaIcon';
import { AnimatedStateButton } from '@/components/ui/AnimatedStateButton';
import { ShareWinCard } from '@/components/features/bounty/ShareWinCard';
import { Neutral } from '@/constants/NeutralColors';
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
                    <AnimatedStateButton
                        state={state === 'success' ? 'success' : 'idle'}
                        idleBg={theme[950]}
                        height={48}
                        disabled={state !== 'idle'}
                        onPress={onShare}
                        accessibilityLabel="Share win"
                        idle={
                            <>
                                <Icon
                                    name="square.and.arrow.up"
                                    size={18}
                                    color={Neutral.white}
                                    weight="semibold"
                                />
                                <ThemedText type="body-md-semibold" style={{ color: Neutral.white }}>
                                    {state === 'sharing' ? 'Rendering…' : 'Share win'}
                                </ThemedText>
                            </>
                        }
                        success={
                            <>
                                <Icon name="checkmark" size={18} color={Neutral.white} weight="semibold" />
                                <ThemedText type="body-md-semibold" style={{ color: Neutral.white }}>
                                    Shared
                                </ThemedText>
                            </>
                        }
                    />
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

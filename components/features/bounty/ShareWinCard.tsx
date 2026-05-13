import React, { forwardRef } from 'react';
import { View, Text, Image } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SolanaIcon } from '@/components/ui/SolanaIcon';
import { Neutral } from '@/constants/NeutralColors';
import { MONO_PALETTE } from '@/constants/ThemePalettes';
import { resolveAvatarUrl } from '@/lib/utils/avatars';
import { formatSol } from '@/lib/utils/formatNumber';
import type { Bounty } from '@/lib/types/bounty';
import type { Profile } from '@/lib/types/profile';

const CARD = 1080;
const PAD = 80;

interface ShareWinCardProps {
    bounty: Bounty;
    winner: Profile | null;
}

export const ShareWinCard = forwardRef<View, ShareWinCardProps>(function ShareWinCard(
    { bounty, winner },
    ref,
) {
    const amountSol = bounty.bountyLamports / 1e9;
    const handle = winner?.username ? `@${winner.username}` : 'A winner';
    const avatarUrl = resolveAvatarUrl(winner?.avatarUrl ?? null);
    const initial = (winner?.displayName?.[0] ?? winner?.username?.[0] ?? '·').toUpperCase();
    const deepLink = `adler://bounty/${bounty.id}`;
    const cardBg = MONO_PALETTE[950];

    return (
        <View
            ref={ref}
            collapsable={false}
            style={{
                width: CARD,
                height: CARD,
                backgroundColor: cardBg,
                padding: PAD,
                justifyContent: 'space-between',
            }}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text
                    style={{
                        fontFamily: 'Geist_600SemiBold',
                        fontSize: 32,
                        letterSpacing: 4,
                        color: Neutral.white,
                        opacity: 0.7,
                    }}
                >
                    ADLER
                </Text>
                <Text
                    style={{
                        fontFamily: 'Geist_600SemiBold',
                        fontSize: 20,
                        letterSpacing: 2.4,
                        color: Neutral.white,
                        opacity: 0.5,
                    }}
                >
                    BOUNTY WON
                </Text>
            </View>

            <View style={{ gap: 32 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 24 }}>
                    <Text
                        style={{
                            fontFamily: 'Geist_600SemiBold',
                            fontSize: 180,
                            lineHeight: 180,
                            color: Neutral.white,
                            letterSpacing: -4,
                        }}
                    >
                        {formatSol(amountSol)}
                    </Text>
                    <SolanaIcon size={64} color={Neutral.white} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                    <View
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: 36,
                            backgroundColor: MONO_PALETTE[800],
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {avatarUrl ? (
                            <Image
                                source={{ uri: avatarUrl }}
                                style={{ width: 72, height: 72 }}
                                resizeMode="cover"
                            />
                        ) : (
                            <Text
                                style={{
                                    fontFamily: 'Geist_600SemiBold',
                                    fontSize: 32,
                                    color: Neutral.white,
                                }}
                            >
                                {initial}
                            </Text>
                        )}
                    </View>
                    <Text
                        style={{
                            fontFamily: 'Geist_600SemiBold',
                            fontSize: 40,
                            color: Neutral.white,
                        }}
                        numberOfLines={1}
                    >
                        {handle} won
                    </Text>
                </View>

                <Text
                    style={{
                        fontFamily: 'Geist_400Regular',
                        fontSize: 28,
                        lineHeight: 38,
                        color: Neutral.white,
                        opacity: 0.7,
                        maxWidth: CARD - PAD * 2 - 220,
                    }}
                    numberOfLines={2}
                >
                    {bounty.title}
                </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Text
                    style={{
                        fontFamily: 'Geist_400Regular',
                        fontSize: 18,
                        color: Neutral.white,
                        opacity: 0.4,
                        letterSpacing: 0.4,
                    }}
                >
                    Scan to view on Adler
                </Text>
                <View
                    style={{
                        padding: 16,
                        backgroundColor: Neutral.white,
                        borderRadius: 16,
                    }}
                >
                    <QRCode
                        value={deepLink}
                        size={160}
                        backgroundColor={Neutral.white}
                        color={Neutral.black}
                    />
                </View>
            </View>
        </View>
    );
});

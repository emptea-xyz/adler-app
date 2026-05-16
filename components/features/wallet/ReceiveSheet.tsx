import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AnimatedStateButton } from '@/components/ui/AnimatedStateButton';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { Neutral } from '@/constants/NeutralColors';
import { haptic } from '@/lib/utils/haptic';

interface Props {
    visible: boolean;
    onClose: () => void;
    walletAddress: string | null;
}

const QR_SIZE = 220;

export function ReceiveSheet({ visible, onClose, walletAddress }: Props) {
    const { theme } = useTheme();

    return (
        <BottomSheet visible={visible} onClose={onClose} title="Receive" height={560}>
            {() => (
                <View style={{ gap: 24, alignItems: 'stretch' }}>
                    <View style={{ alignItems: 'center' }}>
                        {walletAddress ? (
                            <View
                                style={{
                                    padding: 20,
                                    backgroundColor: Neutral.white,
                                    borderRadius: 24,
                                    borderWidth: 1,
                                    borderColor: theme[200],
                                }}
                            >
                                <QRCode
                                    value={walletAddress}
                                    size={QR_SIZE}
                                    backgroundColor={Neutral.white}
                                    color={Neutral.black}
                                />
                            </View>
                        ) : (
                            <View
                                style={{
                                    width: QR_SIZE + 40,
                                    height: QR_SIZE + 40,
                                    backgroundColor: theme[100],
                                    borderRadius: 24,
                                }}
                            />
                        )}
                    </View>

                    <CopyAddressButton walletAddress={walletAddress} />
                </View>
            )}
        </BottomSheet>
    );
}

function CopyAddressButton({ walletAddress }: { walletAddress: string | null }) {
    const { theme } = useTheme();
    const [state, setState] = useState<'idle' | 'success'>('idle');
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
        };
    }, []);

    const onPress = async () => {
        if (!walletAddress) return;
        haptic('medium');
        await Clipboard.setStringAsync(walletAddress);
        setState('success');
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setState('idle'), 1600);
    };

    const idleBg = walletAddress ? theme[950] : theme[300];
    const isInteractive = state === 'idle' && !!walletAddress;

    return (
        <AnimatedStateButton
            state={state}
            idleBg={idleBg}
            height={56}
            disabled={!isInteractive}
            onPress={onPress}
            accessibilityLabel="Copy wallet address"
            contentGap={10}
            contentPaddingX={24}
            idle={
                <>
                    <Icon name="doc.on.doc" size={18} color={theme[50]} weight="semibold" />
                    <ThemedText type="body-md-semibold" style={{ color: theme[50] }} numberOfLines={1}>
                        Copy address
                    </ThemedText>
                </>
            }
            success={
                <>
                    <Icon name="checkmark" size={18} color={Neutral.white} weight="semibold" />
                    <ThemedText type="body-md-semibold" style={{ color: Neutral.white }} numberOfLines={1}>
                        Address copied
                    </ThemedText>
                </>
            }
        />
    );
}

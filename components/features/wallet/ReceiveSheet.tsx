import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { Neutral } from '@/constants/NeutralColors';
import { Status } from '@/constants/StatusColors';
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
    useEffect(() => {
        const t = { duration: 200, easing: Easing.out(Easing.cubic) };
        idleOpacity.value = withTiming(state === 'idle' ? 1 : 0, t);
        successOpacity.value = withTiming(state === 'success' ? 1 : 0, t);
    }, [state, idleOpacity, successOpacity]);

    const idleStyle = useAnimatedStyle(() => ({ opacity: idleOpacity.value }));
    const successStyle = useAnimatedStyle(() => ({ opacity: successOpacity.value }));

    const isInteractive = state === 'idle' && !!walletAddress;

    return (
        <Pressable
            onPress={isInteractive ? onPress : undefined}
            disabled={!isInteractive}
            accessibilityRole="button"
            accessibilityLabel="Copy wallet address"
            accessibilityState={{ disabled: !isInteractive }}
        >
            <Animated.View
                style={[
                    {
                        height: 56,
                        borderRadius: 9999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                    },
                    bgStyle,
                ]}
            >
                <Animated.View style={[ABSOLUTE_CENTER, idleStyle]}>
                    <Icon name="doc.on.doc" size={18} color={theme[50]} weight="semibold" />
                    <ThemedText
                        type="body-md-semibold"
                        style={{ color: theme[50] }}
                        numberOfLines={1}
                    >
                        Copy address
                    </ThemedText>
                </Animated.View>
                <Animated.View style={[ABSOLUTE_CENTER, successStyle]}>
                    <Icon name="checkmark" size={18} color={Neutral.white} weight="semibold" />
                    <ThemedText
                        type="body-md-semibold"
                        style={{ color: Neutral.white }}
                        numberOfLines={1}
                    >
                        Address copied
                    </ThemedText>
                </Animated.View>
            </Animated.View>
        </Pressable>
    );
}

const ABSOLUTE_CENTER: ViewStyle = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
};

import React from 'react';
import { Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { TailwindColors } from '@/constants/TailwindColors';
import { Neutral } from '@/constants/NeutralColors';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

interface Props {
    visible: boolean;
    onClose: () => void;
    walletAddress: string | null;
}

const QR_SIZE = 220;

function shortenAddress(address: string): string {
    if (address.length <= 14) return address;
    return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export function ReceiveSheet({ visible, onClose, walletAddress }: Props) {
    const { theme } = useTheme();

    const copy = async () => {
        if (!walletAddress) return;
        haptic('light');
        await Clipboard.setStringAsync(walletAddress);
        toast.success('Address copied');
    };

    return (
        <BottomSheet visible={visible} onClose={onClose} title="Receive" height={560}>
            {() => (
                <View style={{ gap: 24, alignItems: 'center' }}>
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

                    <Pressable
                        onPress={copy}
                        disabled={!walletAddress}
                        accessibilityRole="button"
                        accessibilityLabel="Copy wallet address"
                        style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            paddingHorizontal: 18,
                            paddingVertical: 12,
                            borderRadius: 9999,
                            backgroundColor: theme[100],
                            opacity: pressed ? 0.7 : 1,
                        })}
                    >
                        <ThemedText
                            type="body-md-semibold"
                            style={{ color: theme[950], letterSpacing: 0.4 }}
                        >
                            {walletAddress ? shortenAddress(walletAddress) : '—'}
                        </ThemedText>
                        <Icon
                            name="doc.on.doc"
                            size={16}
                            color={theme[600]}
                            weight="semibold"
                        />
                    </Pressable>

                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 9999,
                            backgroundColor: TailwindColors.sky[500],
                        }}
                    >
                        <Icon name="arrow.down" size={14} color={Neutral.white} weight="semibold" />
                        <ThemedText
                            type="caption-semibold"
                            style={{ color: Neutral.white, letterSpacing: 0.6, textTransform: 'uppercase' }}
                        >
                            Solana · SOL only
                        </ThemedText>
                    </View>
                </View>
            )}
        </BottomSheet>
    );
}

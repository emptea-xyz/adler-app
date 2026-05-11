import React from 'react';
import { Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { Neutral } from '@/constants/NeutralColors';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

interface Props {
    visible: boolean;
    onClose: () => void;
    walletAddress: string | null;
}

const QR_SIZE = 220;

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

                    <Pressable
                        onPress={copy}
                        disabled={!walletAddress}
                        accessibilityRole="button"
                        accessibilityLabel="Copy wallet address"
                        style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            paddingHorizontal: 24,
                            paddingVertical: 16,
                            minHeight: 56,
                            borderRadius: 9999,
                            backgroundColor: theme[950],
                            opacity: pressed ? 0.7 : 1,
                        })}
                    >
                        <Icon
                            name="doc.on.doc"
                            size={18}
                            color={theme[50]}
                            weight="semibold"
                        />
                        <ThemedText
                            type="body-md-semibold"
                            style={{ color: theme[50] }}
                        >
                            Copy Address
                        </ThemedText>
                    </Pressable>
                </View>
            )}
        </BottomSheet>
    );
}

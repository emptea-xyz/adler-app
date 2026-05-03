import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { SOLANA_NETWORK } from '@/lib/constants/featureGates';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

interface Props {
  visible: boolean;
  onClose: () => void;
  walletAddress: string | null;
}

const QR_SIZE = 200;

export function ReceiveSheet({ visible, onClose, walletAddress }: Props) {
  const { theme } = useTheme();

  const copy = async () => {
    if (!walletAddress) return;
    haptic('light');
    await Clipboard.setStringAsync(walletAddress);
    toast.success('Address copied');
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Receive SOL · ${SOLANA_NETWORK}`}
      height={580}
    >
      {() => (
        <View style={{ gap: 20, alignItems: 'center' }}>
          {walletAddress ? (
            <View
              style={{
                padding: 16,
                backgroundColor: theme[50],
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme[200],
              }}
            >
              <QRCode
                value={walletAddress}
                size={QR_SIZE}
                backgroundColor={theme[50]}
                color={theme[950]}
              />
            </View>
          ) : (
            <View
              style={{
                width: QR_SIZE + 32,
                height: QR_SIZE + 32,
                backgroundColor: theme[100],
                borderRadius: 16,
              }}
            />
          )}

          <ThemedText
            type="body-sm"
            align="center"
            style={{ color: theme[700] }}
          >
            {walletAddress ?? '—'}
          </ThemedText>

          <Button
            title="Copy address"
            onPress={copy}
            variant="secondary"
            className="w-full"
            disabled={!walletAddress}
          />

          {SOLANA_NETWORK === 'devnet' ? (
            <ThemedText
              type="body-xs"
              align="center"
              style={{ color: theme[500], lineHeight: 18 }}
            >
              Need test SOL? Run{' '}
              <ThemedText type="body-xs-semibold" style={{ color: theme[700] }}>
                solana airdrop 1 {walletAddress?.slice(0, 6) ?? '<address>'}… --url devnet
              </ThemedText>{' '}
              from your terminal.
            </ThemedText>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

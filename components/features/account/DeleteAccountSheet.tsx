import React from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
}

export function DeleteAccountSheet({ visible, onClose, onConfirm, submitting }: Props) {
  const { theme } = useTheme();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Delete account"
      height={400}
      dismissible={!submitting}
    >
      {({ close }) => (
        <View style={{ gap: 20 }}>
          <ThemedText type="body-md" style={{ color: theme[700] }}>
            This permanently removes your profile, username, and active listings. Your past orders and applications stay on the books for the other side&apos;s records.
          </ThemedText>
          <ThemedText type="body-sm" style={{ color: theme[500] }}>
            On-chain transactions can&apos;t be undone. Withdraw any SOL from your wallet first.
          </ThemedText>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              title="Cancel"
              onPress={() => close()}
              variant="secondary"
              className="flex-1"
              disabled={submitting}
            />
            <Button
              title="Delete"
              onPress={onConfirm}
              variant="destructive"
              loading={submitting}
              disabled={submitting}
              className="flex-1"
            />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

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

export function SignOutSheet({ visible, onClose, onConfirm, submitting }: Props) {
  const { theme } = useTheme();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Sign out"
      height={300}
      dismissible={!submitting}
    >
      {({ close }) => (
        <View style={{ gap: 20 }}>
          <ThemedText type="body-md" align="center" style={{ color: theme[700] }}>
            Sign out of Adler? You&apos;ll need to sign back in to see your wallet, listings, and orders.
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
              title="Sign out"
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

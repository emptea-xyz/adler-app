import React from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import { KPI } from '@/components/ui/KPI';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
  recipientLabel: string;
  submitting: boolean;
}

export function AwardConfirmSheet({
  visible,
  onClose,
  onConfirm,
  amount,
  recipientLabel,
  submitting,
}: Props) {
  const { theme } = useTheme();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Award gig"
      height={400}
      dismissible={!submitting}
    >
      {({ close }) => (
        <View style={{ gap: 20 }}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <KPI size="lg" amount={amount} unit="SOL" />
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              to {recipientLabel}
            </ThemedText>
          </View>
          <ThemedText type="body-sm" align="center" style={{ color: theme[500] }}>
            This sends a Solana transfer from your embedded wallet. The gig will be marked as awarded.
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
              title="Confirm"
              onPress={onConfirm}
              variant="primary"
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

import React from 'react';
import { Pressable, View, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';

// Figma node 119:129 — embedded wallet balance pill (used in AdlerHomeHeader
// and standalone on settings/wallet).

interface WalletPillProps {
  amount: string;
  loading?: boolean;
  onPress?: () => void;
}

export function WalletPill({ amount, loading = false, onPress }: WalletPillProps) {
  const { theme } = useTheme();

  const inner = (
    <View
      style={{
        backgroundColor: theme[100],
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 9999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme[500]} />
      ) : (
        <>
          <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
            {amount}
          </ThemedText>
          <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
            SOL
          </ThemedText>
        </>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          haptic('light');
          onPress();
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Wallet · ${amount} SOL`}
        accessibilityHint="Opens the wallet sheet"
      >
        {inner}
      </Pressable>
    );
  }

  return inner;
}

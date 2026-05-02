import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';

// Figma nodes 142:154 / 142:158 / 142:162 — sticky bottom CTA on detail
// screens. Caller positions this absolute at the bottom of its scroll area.

interface CtaFooterProps {
  children: React.ReactNode;
  helperText?: string;
}

export function CtaFooter({ children, helperText }: CtaFooterProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 12,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 12,
        backgroundColor: theme[50],
      }}
    >
      {children}
      {helperText ? (
        <ThemedText
          type="body-xs"
          align="center"
          style={{ color: theme[500], marginTop: 8 }}
        >
          {helperText}
        </ThemedText>
      ) : null}
    </View>
  );
}

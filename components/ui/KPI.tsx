import React from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';

// Figma node 117:128 — large amount display (price / budget / total).

interface KPIProps {
  amount: string | number;
  size?: 'md' | 'lg';
  unit?: string;
}

export function KPI({ amount, size = 'md', unit = 'SOL' }: KPIProps) {
  const { theme } = useTheme();
  const isLg = size === 'lg';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <ThemedText
        style={{
          fontFamily: 'Geist_600SemiBold',
          fontSize: isLg ? 56 : 36,
          lineHeight: isLg ? 64 : 44,
          letterSpacing: isLg ? -1.68 : -1.08,
          color: theme[950],
        }}
      >
        {amount}
      </ThemedText>
      {unit ? (
        <ThemedText
          type={isLg ? 'body-lg-semibold' : 'body-md-semibold'}
          style={{ color: theme[500] }}
        >
          {unit}
        </ThemedText>
      ) : null}
    </View>
  );
}

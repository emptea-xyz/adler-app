import React from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { ACCENT_COLORS } from '@/constants/ThemePalettes';

// Figma node 116:132 — status / category pill. Six intents.

export type PillIntent = 'pink' | 'orange' | 'cyan' | 'lime' | 'neutral' | 'dark';

interface PillProps {
  intent: PillIntent;
  label: string;
}

export function Pill({ intent, label }: PillProps) {
  const { theme } = useTheme();

  const bg =
    intent === 'pink' ? ACCENT_COLORS.pink :
    intent === 'orange' ? ACCENT_COLORS.orange :
    intent === 'cyan' ? ACCENT_COLORS.cyan :
    intent === 'lime' ? ACCENT_COLORS.lime :
    intent === 'neutral' ? theme[200] :
    theme[950];

  const fg = intent === 'dark' ? theme[50] : theme[950];

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 9999,
        alignSelf: 'flex-start',
      }}
    >
      <ThemedText type="caption-semibold" style={{ color: fg }}>
        {label}
      </ThemedText>
    </View>
  );
}

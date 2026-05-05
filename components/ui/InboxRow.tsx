import React from 'react';
import { Pressable } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';

// Figma node 128:128 — inbox row card.

interface InboxRowProps {
  title: string;
  subline: string;
  onPress: () => void;
}

export function InboxRow({ title, subline, onPress }: InboxRowProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subline}
      style={{
        backgroundColor: theme[100],
        padding: 20,
        borderRadius: 12,
        gap: 4,
      }}
    >
      <ThemedText type="body-lg-semibold" style={{ color: theme[950] }}>
        {title}
      </ThemedText>
      <ThemedText type="body-sm" style={{ color: theme[500] }} numberOfLines={2}>
        {subline}
      </ThemedText>
    </Pressable>
  );
}

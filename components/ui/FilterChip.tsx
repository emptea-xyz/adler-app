import React from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';

// Figma node 117:133 — sort / category chip on the Browse feed.

interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function FilterChip({ label, active = false, onPress }: FilterChipProps) {
  const { theme } = useTheme();

  const inner = (
    <ThemedText
      type="body-sm-semibold"
      style={{ color: active ? theme[50] : theme[700] }}
    >
      {label}
    </ThemedText>
  );

  const style = {
    backgroundColor: active ? theme[950] : theme[100],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    alignSelf: 'flex-start' as const,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          haptic('light');
          onPress();
        }}
        style={style}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={style}>{inner}</View>;
}

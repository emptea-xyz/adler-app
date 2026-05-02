import React from 'react';
import { Pressable } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { BRAND_ACCENT } from '@/constants/ThemePalettes';

// Figma node 129:134 — role-select card. Default vs selected (filled sky-500
// brand accent with white type).

interface RoleSelectCardProps {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

export function RoleSelectCard({ title, description, selected, onPress }: RoleSelectCardProps) {
  const { theme } = useTheme();

  const bg = selected ? BRAND_ACCENT : theme[100];
  const titleColor = selected ? theme[50] : theme[950];
  const descColor = selected ? theme[50] : theme[500];

  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={{
        backgroundColor: bg,
        padding: 20,
        borderRadius: 12,
        gap: 4,
      }}
    >
      <ThemedText type="body-lg-semibold" style={{ color: titleColor }}>
        {title}
      </ThemedText>
      <ThemedText type="body-sm" style={{ color: descColor }}>
        {description}
      </ThemedText>
    </Pressable>
  );
}

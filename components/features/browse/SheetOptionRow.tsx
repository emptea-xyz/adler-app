import React from 'react';
import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';

// Single row used inside selection sheets (sort, category, price, etc.).

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function SheetOptionRow({ label, selected, onPress }: Props) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: selected ? theme[100] : 'transparent',
      }}
    >
      <ThemedText type="body-md" style={{ color: theme[950] }}>
        {label}
      </ThemedText>
      {selected ? (
        <View>
          <Check size={18} color={theme[950]} />
        </View>
      ) : null}
    </Pressable>
  );
}

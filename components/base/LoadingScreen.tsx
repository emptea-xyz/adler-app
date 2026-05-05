import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { EagleLoader } from '@/components/ui/EagleLoader';
import { useTheme } from '@/contexts/ThemeContext';

interface LoadingScreenProps {
  title?: string;
}

// Figma frame 57:370 — loader screen. Title at top, spinner centered.
export function LoadingScreen({ title }: LoadingScreenProps) {
  const { theme } = useTheme();
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme[50] }}>
      <ThemedView className="flex-1 px-4">
        {title ? (
          <View style={{ paddingTop: 24 }}>
            <ThemedText type="h2" style={{ color: theme[950] }}>
              {title}
            </ThemedText>
          </View>
        ) : null}
        <View className="flex-1 items-center justify-center">
          <EagleLoader size={230} />
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

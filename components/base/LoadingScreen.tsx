import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedView } from '@/components/base/ThemedView';
import LoadingMotive from '@/components/base/LoadingMotive';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * LoadingScreen component displays a branded loading interface.
 * Can be used for:
 * - App initialization
 * - Signing in
 * - Signing out
 * - Auth state transitions
 */
export function LoadingScreen() {
  const { theme } = useTheme();
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme[50] }}>
      <ThemedView className="flex-1 justify-center items-center px-8">
        {/* Loading indicator */}
        <View className="items-center w-full">
          <LoadingMotive />
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

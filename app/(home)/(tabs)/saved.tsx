import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/base/ThemedView';
import EmptyState from '@/components/ui/EmptyState';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { EMPTY_SAVED } from '@/lib/utils/copy';

export default function SavedScreen() {
  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <AdlerHomeHeader title="Saved" />

        <View
          className="flex-1 items-center justify-center"
          style={{ paddingHorizontal: 16, paddingBottom: TAB_BAR_HEIGHT + 32 }}
        >
          <EmptyState title={EMPTY_SAVED.title} description={EMPTY_SAVED.description} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

import React, { useCallback, useRef, useState } from 'react';
import { View, FlatList, Pressable, useWindowDimensions } from 'react-native';
import type { ViewToken, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import { AdlerEagleLogo } from '@/components/ui/AdlerEagleLogo';
import { useTheme } from '@/contexts/ThemeContext';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';
import { haptic } from '@/lib/utils/haptic';

interface Slide {
  id: string;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    title: 'Welcome to Adler',
    description:
      'A two-sided marketplace where creators sell content packages and brands post gigs. Settled directly on Solana.',
  },
  {
    id: 'wallet',
    title: 'Your wallet, ready to go',
    description:
      'Adler creates an embedded Solana wallet for you on first sign-in. You hold the keys; we just route payments.',
  },
  {
    id: 'devnet',
    title: 'Test SOL, no real funds',
    description:
      'Adler runs on devnet during the beta. Top up free test SOL via the Solana CLI from the Wallet screen any time.',
  },
];

export default function IntroScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, 'true').catch(() => {});
    router.replace('/(auth)/role-select');
  }, [router]);

  const onNext = useCallback(() => {
    haptic('light');
    if (isLast) {
      finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }, [isLast, index, finish]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Snap on momentum end as a fallback for cases where viewability lags.
  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(next);
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View
          className="flex-row justify-end px-4"
          style={{ height: 44, alignItems: 'center' }}
        >
          {!isLast ? (
            <Pressable onPress={finish} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip onboarding">
              <ThemedText type="body-sm-semibold" style={{ color: theme[500] }}>
                Skip
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onMomentumScrollEnd={onMomentumScrollEnd}
          renderItem={({ item }) => (
            <View
              style={{
                width,
                paddingHorizontal: 24,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
              }}
            >
              <AdlerEagleLogo size={140} />
              <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 8 }}>
                <ThemedText type="h2" align="center" style={{ color: theme[950] }}>
                  {item.title}
                </ThemedText>
                <ThemedText type="body-md" align="center" style={{ color: theme[500] }}>
                  {item.description}
                </ThemedText>
              </View>
            </View>
          )}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 16 }}>
          {SLIDES.map((s, i) => (
            <View
              key={s.id}
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? theme[950] : theme[300],
              }}
            />
          ))}
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <Button
            title={isLast ? 'Get started' : 'Next'}
            onPress={onNext}
            variant="primary"
            size="lg"
            className="w-full"
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

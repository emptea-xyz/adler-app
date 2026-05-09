import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import { AdlerEagleLogo } from '@/components/ui/AdlerEagleLogo';
import { useTheme } from '@/contexts/ThemeContext';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';
import { haptic } from '@/lib/utils/haptic';

const SLIDES = [
    {
        id: 'welcome',
        title: 'Welcome to Adler',
        description: 'Creators sell content packages. Brands post gigs. One account works both sides.',
    },
    {
        id: 'wallet',
        title: 'Wallet ready',
        description: 'Your embedded Solana wallet is created on sign-in and travels with your account.',
    },
    {
        id: 'devnet',
        title: 'Devnet SOL',
        description: 'Beta payments use test SOL. No real funds move while we harden the marketplace.',
    },
] as const;

export default function OnboardingIntroScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const listRef = useRef<FlatList<(typeof SLIDES)[number]>>(null);
    const [index, setIndex] = useState(0);
    const isLast = index === SLIDES.length - 1;

    const finish = useCallback(async () => {
        await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, 'true').catch(() => {});
        router.replace('/(auth)/onboarding/basics');
    }, [router]);

    const onNext = useCallback(() => {
        haptic('light');
        if (isLast) {
            finish();
            return;
        }
        listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }, [finish, index, isLast]);

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
    }).current;

    const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top', 'bottom']} className="flex-1">
                <View className="flex-row justify-end px-4" style={{ height: 44, alignItems: 'center' }}>
                    {!isLast ? (
                        <Pressable onPress={finish} hitSlop={8} accessibilityRole="button">
                            <ThemedText type="body-sm-semibold" style={{ color: theme[500] }}>
                                Skip
                            </ThemedText>
                        </Pressable>
                    ) : null}
                </View>
                <FlatList
                    ref={listRef}
                    data={SLIDES}
                    keyExtractor={(slide) => slide.id}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
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
                            <AdlerEagleLogo size={136} />
                            <View style={{ alignItems: 'center', gap: 12 }}>
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
                    {SLIDES.map((slide, slideIndex) => (
                        <View
                            key={slide.id}
                            style={{
                                width: slideIndex === index ? 18 : 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: slideIndex === index ? theme[950] : theme[300],
                            }}
                        />
                    ))}
                </View>
                <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
                    <Button title={isLast ? 'Get started' : 'Next'} onPress={onNext} size="lg" />
                </View>
            </SafeAreaView>
        </ThemedView>
    );
}

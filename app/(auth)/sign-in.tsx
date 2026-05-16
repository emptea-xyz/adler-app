import React, { useCallback, useState } from 'react';
import {
  View,
  Pressable,
  ActivityIndicator,
  Linking,
  StyleSheet,
  ScrollView,
  Image,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLoginWithOAuth } from '@privy-io/expo';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/base/ThemedText';
import { AdlerEagleLogo } from '@/components/ui/AdlerEagleLogo';
import { Spinner } from '@/components/ui/Spinner';
import { Neutral } from '@/constants/NeutralColors';
import { MONO_PALETTE } from '@/constants/ThemePalettes';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

type Provider = 'google' | 'apple';

type Slide = {
  title: string;
  body: string;
  image: number;
};

const SLIDES: Slide[] = [
  {
    title: 'Post a bounty.',
    body: 'Fund any task in SOL. Escrow holds the prize until you pick a winner.',
    image: require('@/assets/images/slide-0.png'),
  },
  {
    title: 'Submit your work.',
    body: 'Reply to any open bounty with a photo, video, or link. One shot per bounty.',
    image: require('@/assets/images/slide-1.png'),
  },
  {
    title: 'Get paid on-chain.',
    body: 'Poster picks the winner. The Anchor escrow pays out instantly on Solana.',
    image: require('@/assets/images/slide-2.png'),
  },
];

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [pending, setPending] = useState<Provider | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const contentOpacity = useSharedValue(1);
  const loaderOpacity = useSharedValue(0);

  const startTransition = useCallback(() => {
    contentOpacity.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
    loaderOpacity.value = withDelay(300, withTiming(1, { duration: 300, easing: Easing.in(Easing.quad) }));
  }, [contentOpacity, loaderOpacity]);

  const { login } = useLoginWithOAuth({
    onError: (err) => {
      const msg = err?.message ?? '';
      if (msg.toLowerCase().includes('cancel')) {
        setPending(null);
        return;
      }
      toast.error(msg || 'Sign-in failed');
      setPending(null);
    },
    onSuccess: () => {
      setTransitioning(true);
      startTransition();
    },
  });

  const onSocialPress = useCallback(
    async (provider: Provider) => {
      if (pending || transitioning) return;
      haptic('light');
      setPending(provider);
      try {
        await login({ provider });
      } catch {
        // Errors surface via onError above.
      }
    },
    [pending, transitioning, login],
  );

  const onSlideScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      setActiveSlide(idx);
    },
    [screenWidth],
  );

  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const loaderStyle = useAnimatedStyle(() => ({ opacity: loaderOpacity.value }));

  const otherPending = (mine: Provider) => pending && pending !== mine;

  return (
    <View style={{ flex: 1, backgroundColor: Neutral.white }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, contentStyle]}>
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          {/* Top strip */}
          <View
            className="flex-row items-center"
            style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'transparent' }}
          >
            <AdlerEagleLogo size={28} />
          </View>

          {/* Slideshow */}
          <View style={{ flex: 1 }}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onSlideScrollEnd}
            >
              {SLIDES.map((slide, i) => (
                <View
                  key={i}
                  style={{ width: screenWidth, paddingHorizontal: 24, flex: 1 }}
                >
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: '100%', maxWidth: 280, aspectRatio: 1 }}>
                      <Image
                        source={slide.image}
                        resizeMode="contain"
                        style={{ width: '100%', height: '100%' }}
                      />
                      <Svg
                        pointerEvents="none"
                        style={StyleSheet.absoluteFill}
                        preserveAspectRatio="none"
                        viewBox="0 0 1 1"
                      >
                        <Defs>
                          <SvgLinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={Neutral.white} stopOpacity="1" />
                            <Stop offset="0.05" stopColor={Neutral.white} stopOpacity="0.2" />
                            <Stop offset="0.1" stopColor={Neutral.white} stopOpacity="0" />
                            <Stop offset="0.9" stopColor={Neutral.white} stopOpacity="0" />
                            <Stop offset="0.95" stopColor={Neutral.white} stopOpacity="0.2" />
                            <Stop offset="1" stopColor={Neutral.white} stopOpacity="1" />
                          </SvgLinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="1" height="1" fill="url(#fade)" />
                      </Svg>
                    </View>
                  </View>

                  <View style={{ alignSelf: 'flex-start', paddingBottom: 24, gap: 6 }}>
                    <ThemedText type="h3" style={{ color: Neutral.black }}>
                      {slide.title}
                    </ThemedText>
                    <ThemedText type="body-md" style={{ color: MONO_PALETTE[500] }}>
                      {slide.body}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Pagination dots */}
          <View className="flex-row justify-center" style={{ gap: 8, paddingVertical: 16 }}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === activeSlide ? Neutral.black : MONO_PALETTE[300],
                }}
              />
            ))}
          </View>

          {/* Bottom CTA */}
          <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
            <View className="flex-row" style={{ gap: 12 }}>
              <Pressable
                onPress={() => onSocialPress('apple')}
                disabled={!!pending || transitioning}
                className="rounded-card h-14 flex-row items-center justify-center"
                style={{
                  flex: 1,
                  backgroundColor: Neutral.black,
                  opacity: otherPending('apple') ? 0.5 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Apple"
              >
                {pending === 'apple' ? (
                  <ActivityIndicator size="small" color={Neutral.white} />
                ) : (
                  <ThemedText type="body-lg-semibold" style={{ color: Neutral.white }}>
                    Apple
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                onPress={() => onSocialPress('google')}
                disabled={!!pending || transitioning}
                className="rounded-card h-14 flex-row items-center justify-center"
                style={{
                  flex: 1,
                  backgroundColor: Neutral.black,
                  opacity: otherPending('google') ? 0.5 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
              >
                {pending === 'google' ? (
                  <ActivityIndicator size="small" color={Neutral.white} />
                ) : (
                  <ThemedText type="body-lg-semibold" style={{ color: Neutral.white }}>
                    Google
                  </ThemedText>
                )}
              </Pressable>
            </View>

            <ThemedText
              type="body-xs"
              align="center"
              className="px-4"
              style={{ color: MONO_PALETTE[500], paddingTop: 8 }}
            >
              By continuing you accept our{' '}
              <ThemedText
                type="body-xs"
                className="underline"
                onPress={() => Linking.openURL('https://emptea.xyz/terms-of-service')}
              >
                Terms of Service
              </ThemedText>
              {' '}and{' '}
              <ThemedText
                type="body-xs"
                className="underline"
                onPress={() => Linking.openURL('https://emptea.xyz/privacy-policy')}
              >
                Privacy Policy
              </ThemedText>
              .
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, loaderStyle]}>
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <View className="flex-1 items-center justify-center px-4">
            <Spinner size={48} />
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

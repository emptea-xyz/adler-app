import React, { useCallback, useState } from 'react';
import { View, Pressable, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoginWithOAuth } from '@privy-io/expo';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { AdlerEagleLogo } from '@/components/ui/AdlerEagleLogo';
import { Spinner } from '@/components/ui/Spinner';
import { useTheme } from '@/contexts/ThemeContext';
import { TailwindColors } from '@/constants/TailwindColors';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

type Provider = 'google' | 'apple';

function SkyHalo() {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 280, pointerEvents: 'none' as const }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 393 280">
        <Defs>
          <RadialGradient id="halo" cx="196" cy="460" rx="260" ry="360" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={TailwindColors.sky[500]} stopOpacity="1" />
            <Stop offset="0.35" stopColor={TailwindColors.sky[400]} stopOpacity="0.7" />
            <Stop offset="0.65" stopColor={TailwindColors.sky[300]} stopOpacity="0.35" />
            <Stop offset="1" stopColor={TailwindColors.sky[500]} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="393" height="280" fill="url(#halo)" />
      </Svg>
    </View>
  );
}

export default function SignInScreen() {
  const { theme, isDark } = useTheme();
  const [pending, setPending] = useState<Provider | null>(null);
  const [transitioning, setTransitioning] = useState(false);

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

  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const loaderStyle = useAnimatedStyle(() => ({ opacity: loaderOpacity.value }));

  const otherPending = (mine: Provider) => pending && pending !== mine;

  return (
    <ThemedView className="flex-1">
      <Animated.View style={[StyleSheet.absoluteFillObject, contentStyle]}>
        <SkyHalo />
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <View className="flex-1 px-4 justify-between" style={{ paddingTop: 24, paddingBottom: 24 }}>
            <View className="flex-1 items-center justify-center" style={{ gap: 8 }}>
              <AdlerEagleLogo size={171} />
              <View className="items-center">
                <ThemedText type="h2" style={{ color: theme[950] }}>
                  Adler
                </ThemedText>
                <ThemedText type="body-md" style={{ color: theme[300] }}>
                  Trade content.
                </ThemedText>
              </View>
            </View>

            <View style={{ gap: 12 }}>
              <View
                style={{
                  height: 56,
                  opacity: otherPending('apple') ? 0.5 : 1,
                }}
                pointerEvents={pending || transitioning ? 'none' : 'auto'}
              >
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={
                    isDark
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={16}
                  style={{ width: '100%', height: 56 }}
                  onPress={() => onSocialPress('apple')}
                />
              </View>

              <Pressable
                onPress={() => onSocialPress('google')}
                disabled={!!pending || transitioning}
                className="rounded-card h-14 flex-row items-center justify-center"
                style={{
                  backgroundColor: theme[950],
                  opacity: otherPending('google') ? 0.5 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
              >
                {pending === 'google' ? (
                  <ActivityIndicator size="small" color={theme[50]} />
                ) : (
                  <ThemedText type="body-lg-semibold" style={{ color: theme[50] }}>
                    Sign in with Google
                  </ThemedText>
                )}
              </Pressable>

              <ThemedText
                type="body-xs"
                align="center"
                className="px-4"
                style={{ color: theme[500], paddingTop: 8 }}
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
        </SafeAreaView>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, loaderStyle]}>
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <View className="flex-1 items-center justify-center px-4">
            <Spinner size={48} />
          </View>
        </SafeAreaView>
      </Animated.View>
    </ThemedView>
  );
}

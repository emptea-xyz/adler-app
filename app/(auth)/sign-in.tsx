import React, { useCallback, useState } from 'react';
import { View, Pressable, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoginWithOAuth } from '@privy-io/expo';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { AdlerEagleLogo } from '@/components/ui/AdlerEagleLogo';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

type Provider = 'apple' | 'google';

// Figma node 56:236 — sign-in bottom radial halo. Hot pink center fading to
// transparent at the edges. Center is below the visible bounds so we see only
// the upper portion.
function PinkHalo() {
  // Center pushed well below the visible band so only the soft upper arc of
  // the halo bleeds onto the screen — never the saturated core.
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 280, pointerEvents: 'none' as const }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 393 280">
        <Defs>
          <RadialGradient id="halo" cx="196" cy="460" rx="260" ry="360" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ff0088" stopOpacity="1" />
            <Stop offset="0.35" stopColor="#ff40a6" stopOpacity="0.7" />
            <Stop offset="0.65" stopColor="#ff80c4" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="393" height="280" fill="url(#halo)" />
      </Svg>
    </View>
  );
}

export default function SignInScreen() {
  const { theme } = useTheme();
  const [pending, setPending] = useState<Provider | null>(null);

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
      setPending(null);
    },
  });

  const onSocialPress = useCallback(
    async (provider: Provider) => {
      if (pending) return;
      haptic('light');
      setPending(provider);
      try {
        await login({ provider });
      } catch {
        // Errors surface via onError above.
      }
    },
    [pending, login],
  );

  return (
    <ThemedView className="flex-1">
      <PinkHalo />
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-4 justify-between" style={{ paddingTop: 24, paddingBottom: 24 }}>
          {/* Hero */}
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

          {/* CTA stack */}
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={() => onSocialPress('apple')}
              disabled={!!pending}
              className="rounded-card h-14 flex-row items-center justify-center"
              style={{
                backgroundColor: theme[950],
                opacity: pending && pending !== 'apple' ? 0.5 : 1,
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Apple"
            >
              {pending === 'apple' ? (
                <ActivityIndicator size="small" color={theme[50]} />
              ) : (
                <ThemedText type="body-lg-semibold" style={{ color: theme[50] }}>
                  Sign in with Apple
                </ThemedText>
              )}
            </Pressable>

            <Pressable
              onPress={() => onSocialPress('google')}
              disabled={!!pending}
              className="rounded-card h-14 flex-row items-center justify-center"
              style={{
                backgroundColor: theme[50],
                borderWidth: 1,
                borderColor: theme[300],
                opacity: pending && pending !== 'google' ? 0.5 : 1,
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Google"
            >
              {pending === 'google' ? (
                <ActivityIndicator size="small" color={theme[950]} />
              ) : (
                <ThemedText type="body-lg-semibold" style={{ color: theme[950] }}>
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
    </ThemedView>
  );
}

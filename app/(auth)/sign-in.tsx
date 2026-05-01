import React, { useCallback, useState } from 'react';
import { View, Pressable, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoginWithOAuth } from '@privy-io/expo';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

type Provider = 'apple' | 'google';

export default function SignInScreen() {
  const { theme } = useTheme();
  const [pending, setPending] = useState<Provider | null>(null);

  const { login } = useLoginWithOAuth({
    onError: (err) => {
      // Cancellations come through as errors too — silence the obvious ones.
      const msg = err?.message ?? '';
      if (msg.toLowerCase().includes('cancel')) {
        setPending(null);
        return;
      }
      toast.error(msg || 'Sign-in failed');
      setPending(null);
    },
    onSuccess: () => {
      // AuthContext picks up the Privy user, mints a Firebase token, and
      // app/index.tsx routes us to /(auth)/role-select or /(home)/(tabs)/browse.
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
        // Errors surface via the onError callback above.
      }
    },
    [pending, login],
  );

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-6 pt-12 pb-8 justify-between">
          <View>
            <ThemedText type="h2" className="tracking-tight">
              Welcome to Adler
            </ThemedText>
            <ThemedText type="body-md" className="mt-2" style={{ color: theme[500] }}>
              Sign in to get a Solana wallet and start trading content packages or
              gigs with verified accounts.
            </ThemedText>
          </View>

          <View className="gap-3">
            {/* Apple — black/white per HIG, mandatory on iOS when any other
                social is offered. */}
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

            {/* Google */}
            <Pressable
              onPress={() => onSocialPress('google')}
              disabled={!!pending}
              className="rounded-card h-14 flex-row items-center justify-center border"
              style={{
                backgroundColor: theme[50],
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
              className="px-4 mt-4"
              style={{ color: theme[500] }}
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

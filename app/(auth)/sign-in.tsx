import React, { useCallback, useState } from 'react';
import { View, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoginWithEmail } from '@privy-io/expo';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/lib/utils/toast';

type Step = 'email' | 'code';

export default function SignInScreen() {
  const { theme } = useTheme();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { sendCode, loginWithCode } = useLoginWithEmail({
    onError: (err) => {
      toast.error(err?.message ?? 'Sign-in failed');
      setSubmitting(false);
    },
    onLoginSuccess: () => {
      // The AuthContext bridge picks this up and routes via app/index.tsx.
      setSubmitting(false);
    },
    onSendCodeSuccess: () => {
      setSubmitting(false);
      setStep('code');
    },
  });

  const requestCode = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      await sendCode({ email: trimmed });
    } catch {
      // Errors surface via onError above.
    }
  }, [email, sendCode]);

  const submitCode = useCallback(async () => {
    if (code.length < 4) {
      toast.error('Enter the code from your email');
      return;
    }
    setSubmitting(true);
    try {
      await loginWithCode({ code });
    } catch {
      // Errors surface via onError above.
    }
  }, [code, loginWithCode]);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-6 pt-12 pb-8 justify-between">
          <View>
            <ThemedText type="h2" className="tracking-tight">
              Welcome to Adler
            </ThemedText>
            <ThemedText type="body-md" className="mt-2" style={{ color: theme[500] }}>
              {step === 'email'
                ? 'Sign in with your email. We\'ll send you a one-time code and create a Solana wallet for you.'
                : `Enter the 6-digit code we sent to ${email}.`}
            </ThemedText>
          </View>

          <View>
            {step === 'email' ? (
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="go"
                onSubmitEditing={requestCode}
              />
            ) : (
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                keyboardType="number-pad"
                returnKeyType="go"
                onSubmitEditing={submitCode}
              />
            )}
          </View>

          <View className="gap-3">
            <Button
              title={step === 'email' ? 'Continue' : 'Sign in'}
              onPress={step === 'email' ? requestCode : submitCode}
              loading={submitting}
              disabled={submitting}
              variant="primary"
              size="lg"
            />
            {step === 'code' && (
              <Button
                title="Back to email"
                onPress={() => {
                  setStep('email');
                  setCode('');
                }}
                variant="tertiary"
                disabled={submitting}
              />
            )}

            <ThemedText type="body-xs" align="center" className="px-4 mt-4" style={{ color: theme[500] }}>
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

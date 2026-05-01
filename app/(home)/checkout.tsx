import React, { useCallback, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSolanaPayment } from '@/hooks/useSolanaPayment';
import { ORDER_KEYS } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import type { OrderType } from '@/types/marketplace';

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{
    type: OrderType;
    referenceId: string;
    sellerId: string;
    amountSol: string;
    title: string;
  }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { pay, walletAddress, ready } = useSolanaPayment();

  const [submitting, setSubmitting] = useState(false);
  const amountSol = parseFloat(params.amountSol ?? '0');

  const onConfirm = useCallback(async () => {
    if (!ready) {
      toast.error('Wallet not ready yet');
      return;
    }
    setSubmitting(true);
    try {
      const { signature } = await pay({
        type: params.type,
        referenceId: params.referenceId,
        sellerId: params.sellerId,
        amountSol,
      });
      if (user) {
        queryClient.invalidateQueries({ queryKey: ORDER_KEYS.asBuyer(user.id) });
      }
      toast.success(`Payment sent · ${signature.slice(0, 8)}…`);
      router.replace('/(home)/(tabs)/inbox');
    } catch (err: any) {
      toast.error(err?.message ?? 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  }, [pay, params, amountSol, ready, queryClient, router, user]);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScreenHeader title="Checkout" onBack={() => router.back()} />

        <View className="flex-1 px-6 pt-6 justify-between">
          <View className="gap-4">
            <Card>
              <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                ITEM
              </ThemedText>
              <ThemedText type="body-lg-semibold" className="mt-1">
                {params.title}
              </ThemedText>
            </Card>

            <Card>
              <View className="flex-row justify-between">
                <ThemedText type="body-md" style={{ color: theme[500] }}>
                  Amount
                </ThemedText>
                <ThemedText type="body-md-semibold">{amountSol} SOL</ThemedText>
              </View>
              <View className="flex-row justify-between mt-2">
                <ThemedText type="body-md" style={{ color: theme[500] }}>
                  From
                </ThemedText>
                <ThemedText type="body-sm">
                  {walletAddress ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}` : '—'}
                </ThemedText>
              </View>
              <View className="flex-row justify-between mt-1">
                <ThemedText type="body-md" style={{ color: theme[500] }}>
                  Network
                </ThemedText>
                <ThemedText type="body-sm">Solana devnet</ThemedText>
              </View>
            </Card>
          </View>

          <View className="gap-2 pb-4">
            <Button
              title={submitting ? 'Sending…' : `Pay ${amountSol} SOL`}
              onPress={onConfirm}
              loading={submitting}
              disabled={submitting || !ready}
              variant="primary"
              size="lg"
            />
            {!ready && (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator size="small" color={theme[500]} />
                <ThemedText type="body-sm" style={{ color: theme[500] }}>
                  Waiting for wallet…
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

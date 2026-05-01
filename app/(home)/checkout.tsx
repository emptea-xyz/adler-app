import React, { useCallback, useState } from 'react';
import { View, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { haptic } from '@/lib/utils/haptic';
import { SOLANA_NETWORK } from '@/lib/constants/featureGates';
import type { OrderType } from '@/types/marketplace';

function shortenAddress(address: string | null): string {
  if (!address) return '—';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

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
  const insets = useSafeAreaInsets();

  const [submitting, setSubmitting] = useState(false);
  const amountSol = parseFloat(params.amountSol ?? '0');

  const onConfirm = useCallback(async () => {
    if (!ready) {
      toast.error('Wallet not ready yet');
      return;
    }
    haptic('medium');
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
      haptic('heavy');
      toast.success(`Payment sent · ${signature.slice(0, 8)}…`);
      router.replace('/(home)/(tabs)/inbox');
    } catch (err: any) {
      toast.error(err?.message ?? 'Payment failed');
      setSubmitting(false);
    }
  }, [pay, params, amountSol, ready, queryClient, router, user]);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader title="Checkout" onBack={() => router.back()} />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 140,
            gap: 16,
          }}
        >
          {/* Top-left amount KPI. Single biggest data point on the screen —
              the user is approving a value transfer, that's all that matters. */}
          <View>
            <View className="flex-row items-baseline gap-2">
              <ThemedText type="h1" className="tracking-tight">
                {amountSol}
              </ThemedText>
              <ThemedText type="body-lg-semibold" style={{ color: theme[500] }}>
                SOL
              </ThemedText>
            </View>
            <ThemedText type="body-sm" style={{ color: theme[500] }} className="mt-1">
              {SOLANA_NETWORK === 'devnet'
                ? 'Devnet · this is test SOL, not real funds'
                : `${SOLANA_NETWORK} · real SOL transfer`}
            </ThemedText>
          </View>

          <Card>
            <ThemedText type="caption-semibold" style={{ color: theme[500], letterSpacing: 0.6 }}>
              ITEM
            </ThemedText>
            <ThemedText type="body-md-semibold" className="mt-2" numberOfLines={2}>
              {params.title}
            </ThemedText>
          </Card>

          <Card>
            <ThemedText type="caption-semibold" style={{ color: theme[500], letterSpacing: 0.6 }}>
              FROM
            </ThemedText>
            <ThemedText type="body-md-semibold" className="mt-2">
              {shortenAddress(walletAddress)}
            </ThemedText>
            <ThemedText type="body-xs" style={{ color: theme[500] }}>
              Your embedded wallet
            </ThemedText>
          </Card>
        </ScrollView>

        <View
          className="px-6"
          style={{
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            backgroundColor: theme[50],
            borderTopWidth: 1,
            borderTopColor: theme[200],
          }}
        >
          <Button
            title={submitting ? 'Sending…' : `Pay ${amountSol} SOL`}
            onPress={onConfirm}
            loading={submitting}
            disabled={submitting || !ready}
            variant="primary"
            size="lg"
          />
          {!ready && (
            <View className="flex-row items-center justify-center gap-2 mt-2">
              <ActivityIndicator size="small" color={theme[500]} />
              <ThemedText type="body-sm" style={{ color: theme[500] }}>
                Waiting for wallet…
              </ThemedText>
            </View>
          )}
          {ready && !submitting && (
            <ThemedText
              type="body-xs"
              align="center"
              style={{ color: theme[500] }}
              className="mt-2"
            >
              Tapping Pay sends a Solana transfer from your embedded wallet.
            </ThemedText>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

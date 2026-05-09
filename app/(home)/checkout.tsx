import React, { useCallback, useState } from 'react';
import { View, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { KPI } from '@/components/ui/KPI';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSolanaPayment } from '@/hooks/useSolanaPayment';
import { formatSol, parseSolAmount } from '@/lib/utils/formatNumber';
import { qk } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { SOLANA_NETWORK } from '@/lib/constants/featureGates';
import { ACCENT_COLORS } from '@/constants/ThemePalettes';
import type { OrderType } from '@/types/marketplace';

function shortenAddress(address: string | null): string {
  if (!address) return '—';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{
    type: OrderType;
    listingId: string;
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
  const amountSol = parseSolAmount(params.amountSol ?? '') ?? 0;

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
        listingId: params.listingId,
        listingTitle: params.title,
        sellerId: params.sellerId,
        amountSol,
      });
      if (user) {
        queryClient.invalidateQueries({ queryKey: qk.orders.byBuyer(user.id) });
      }
      haptic('heavy');
      toast.success(`Payment sent · ${signature.slice(0, 8)}…`);
      router.replace('/(home)/(tabs)/inbox');
    } catch (err: any) {
      toast.error(err?.message ?? 'Payment failed');
      setSubmitting(false);
    }
  }, [pay, params, amountSol, ready, queryClient, router, user]);

  const isDevnet = SOLANA_NETWORK === 'devnet';
  const networkCaption = isDevnet
    ? 'Devnet · this is test SOL, not real funds'
    : `${SOLANA_NETWORK} · real SOL transfer`;
  const networkColor = isDevnet ? ACCENT_COLORS.pink : theme[500];

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader title="Checkout" onBack={() => router.back()} />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 160,
            gap: 16,
          }}
        >
          {/* Big amount KPI */}
          <View style={{ gap: 4 }}>
            <KPI size="lg" amount={formatSol(amountSol)} unit="SOL" />
            <ThemedText type="body-sm" style={{ color: networkColor }}>
              {networkCaption}
            </ThemedText>
          </View>

          {/* Item */}
          <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
            <SectionLabel label="Item" />
            <ThemedText type="body-md-semibold" style={{ color: theme[950] }} numberOfLines={2}>
              {params.title}
            </ThemedText>
          </View>

          {/* From */}
          <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 4 }}>
            <SectionLabel label="From" />
            <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
              {shortenAddress(walletAddress)}
            </ThemedText>
            <ThemedText type="body-xs" style={{ color: theme[500] }}>
              Your embedded wallet
            </ThemedText>
          </View>
        </ScrollView>

        <CtaFooter
          helperText={
            ready && !submitting
              ? 'Tapping Pay sends a Solana transfer from your embedded wallet.'
              : !ready
              ? 'Waiting for wallet…'
              : undefined
          }
        >
          <Button
            title={submitting ? 'Sending…' : `Pay ${formatSol(amountSol)} SOL`}
            onPress={onConfirm}
            loading={submitting}
            disabled={submitting || !ready}
            variant="primary"
            size="lg"
            className="w-full"
          />
          {!ready && !submitting ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
              <ActivityIndicator size="small" color={theme[500]} />
            </View>
          ) : null}
        </CtaFooter>
      </SafeAreaView>
    </ThemedView>
  );
}

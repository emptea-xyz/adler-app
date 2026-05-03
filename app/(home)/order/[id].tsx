import React from 'react';
import { View, ScrollView, ActivityIndicator, Linking, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { KPI } from '@/components/ui/KPI';
import { Pill, type PillIntent } from '@/components/ui/Pill';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { useTheme } from '@/contexts/ThemeContext';
import { getOrder } from '@/lib/services/orderService';
import { ORDER_KEYS } from '@/lib/constants/queryKeys';
import { explorerTxUrl } from '@/lib/solana/connection';
import { haptic } from '@/lib/utils/haptic';
import type { OrderStatus } from '@/types/marketplace';

function statusToIntent(status: OrderStatus): PillIntent {
  if (status === 'paid' || status === 'complete') return 'lime';
  if (status === 'delivered') return 'cyan';
  return 'neutral';
}

function ucfirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();

  const { data: order, isLoading } = useQuery({
    queryKey: id ? ORDER_KEYS.detail(id) : ['order', 'unknown'],
    enabled: !!id,
    queryFn: () => getOrder(id!),
  });

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader title="Order" onBack={() => router.back()} />

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : !order ? (
          <View className="flex-1 items-center justify-center px-4">
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              Order not found.
            </ThemedText>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: order.txSignature ? 134 : 32,
                gap: 16,
              }}
            >
              {/* Status pills + KPI */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pill intent={statusToIntent(order.status)} label={ucfirst(order.status)} />
                  <Pill intent="pink" label={order.type} />
                </View>
                <KPI size="md" amount={order.amountSol} unit="SOL" />
              </View>

              {/* Buyer/Seller/Reference */}
              <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                {[
                  ['Buyer', order.buyerId],
                  ['Seller', order.sellerId],
                  ['Reference', order.referenceId],
                ].map(([label, value]) => (
                  <View
                    key={label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <ThemedText type="body-md" style={{ color: theme[500] }}>
                      {label}
                    </ThemedText>
                    <ThemedText type="body-sm" style={{ color: theme[700] }}>
                      {value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-4)}` : value}
                    </ThemedText>
                  </View>
                ))}
              </View>

              {/* Tx signature */}
              {order.txSignature ? (
                <Pressable
                  onPress={() => {
                    haptic('light');
                    Linking.openURL(explorerTxUrl(order.txSignature!));
                  }}
                  style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 4 }}
                >
                  <SectionLabel label="Tx signature" />
                  <ThemedText type="body-sm" style={{ color: theme[950] }}>
                    {order.txSignature.slice(0, 16)}…
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme[500] }}>
                    Tap to open on Solana Explorer
                  </ThemedText>
                </Pressable>
              ) : (
                <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12 }}>
                  <ThemedText type="body-sm" style={{ color: theme[500] }}>
                    Waiting for on-chain confirmation…
                  </ThemedText>
                </View>
              )}
            </ScrollView>

            {order.txSignature && (
              <CtaFooter>
                <Button
                  title="View on Solana Explorer"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onPress={() => {
                    haptic('light');
                    Linking.openURL(explorerTxUrl(order.txSignature!));
                  }}
                />
              </CtaFooter>
            )}
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

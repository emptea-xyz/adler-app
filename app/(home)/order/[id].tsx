import React from 'react';
import { View, ScrollView, ActivityIndicator, Linking, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import Card from '@/components/ui/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { getOrder } from '@/lib/services/orderService';
import { ORDER_KEYS } from '@/lib/constants/queryKeys';
import { explorerTxUrl } from '@/lib/solana/connection';

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
          <View className="flex-1 items-center justify-center px-6">
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              Order not found.
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
            <View>
              <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                {order.status.toUpperCase()} · {order.type.toUpperCase()}
              </ThemedText>
              <ThemedText type="h3" className="mt-1">
                {order.amountSol} SOL
              </ThemedText>
            </View>

            <Card>
              <View className="flex-row justify-between mb-2">
                <ThemedText type="body-md" style={{ color: theme[500] }}>
                  Buyer
                </ThemedText>
                <ThemedText type="body-sm">
                  {order.buyerId.slice(0, 12)}…
                </ThemedText>
              </View>
              <View className="flex-row justify-between mb-2">
                <ThemedText type="body-md" style={{ color: theme[500] }}>
                  Seller
                </ThemedText>
                <ThemedText type="body-sm">
                  {order.sellerId.slice(0, 12)}…
                </ThemedText>
              </View>
              <View className="flex-row justify-between">
                <ThemedText type="body-md" style={{ color: theme[500] }}>
                  Reference
                </ThemedText>
                <ThemedText type="body-sm">{order.referenceId.slice(0, 12)}…</ThemedText>
              </View>
            </Card>

            {order.txSignature ? (
              <Pressable onPress={() => Linking.openURL(explorerTxUrl(order.txSignature!))}>
                <Card>
                  <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                    TX SIGNATURE
                  </ThemedText>
                  <ThemedText type="body-sm" className="mt-1 underline">
                    {order.txSignature.slice(0, 24)}…
                  </ThemedText>
                  <ThemedText type="caption" className="mt-1" style={{ color: theme[500] }}>
                    Tap to open on Solana Explorer
                  </ThemedText>
                </Card>
              </Pressable>
            ) : (
              <Card>
                <ThemedText type="body-sm" style={{ color: theme[500] }}>
                  Waiting for on-chain confirmation…
                </ThemedText>
              </Card>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

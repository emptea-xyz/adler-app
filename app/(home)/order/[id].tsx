import React, { useCallback, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Linking, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { KPI } from '@/components/ui/KPI';
import { Pill, type PillIntent } from '@/components/ui/Pill';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { ReviewSheet } from '@/components/features/reviews/ReviewSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getOrder,
  markOrderComplete,
  markOrderDelivered,
} from '@/lib/services/ordersService';
import {
  listReviewsForOrder,
} from '@/lib/services/reviewsService';
import { getProfile } from '@/lib/services/profileService';
import { formatSol } from '@/lib/utils/formatNumber';
import { qk } from '@/lib/constants/queryKeys';
import { explorerTxUrl } from '@/lib/solana/connection';
import { haptic } from '@/lib/utils/haptic';
import { toast } from '@/lib/utils/toast';
import type { OrderStatus, Review } from '@/types/marketplace';

function statusToIntent(status: OrderStatus): PillIntent {
  if (status === 'paid' || status === 'complete') return 'lime';
  if (status === 'delivered') return 'cyan';
  if (status === 'failed') return 'orange';
  return 'neutral';
}

function ucfirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function meanRating(review: Review): number {
  const { scope, communication, timeliness, quality } = review.axes;
  return (scope + communication + timeliness + quality) / 4;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: id ? qk.orders.detail(id) : ['orders', 'detail', 'unknown'],
    enabled: !!id,
    queryFn: () => getOrder(id!),
  });

  const isSeller = !!user && order?.sellerId === user.id;
  const isBuyer = !!user && order?.buyerId === user.id;
  const canMarkDelivered = isSeller && order?.status === 'paid';
  const canConfirmComplete = isBuyer && order?.status === 'delivered';

  const reviewsQuery = useQuery({
    queryKey: order?.id ? ['reviews', 'forOrder', order.id] : ['reviews', 'forOrder', 'unknown'],
    enabled: !!order && order.status === 'complete',
    queryFn: () => listReviewsForOrder(order!.id),
  });
  const reviews = reviewsQuery.data ?? [];
  const myReview = !!user ? reviews.find((r) => r.reviewerId === user.id) ?? null : null;
  const theirReview = !!user ? reviews.find((r) => r.reviewerId !== user.id) ?? null : null;
  const counterpartyId =
    !!user && order
      ? order.buyerId === user.id
        ? order.sellerId
        : order.sellerId === user.id
          ? order.buyerId
          : null
      : null;
  const counterpartyQuery = useQuery({
    queryKey: counterpartyId ? qk.profiles.detail(counterpartyId) : ['profiles', 'detail', 'unknown'],
    enabled: !!counterpartyId && order?.status === 'complete',
    queryFn: () => getProfile(counterpartyId!),
  });
  const counterpartyLabel =
    counterpartyQuery.data?.displayName ?? counterpartyQuery.data?.username ?? 'them';

  const canLeaveReview =
    !!user && !!order && order.status === 'complete' && !myReview && !!counterpartyId;
  const [reviewSheet, setReviewSheet] = useState(false);

  const transitionTo = useCallback(
    async (next: 'delivered' | 'complete', successMessage: string) => {
      if (!order) return;
      haptic('medium');
      setUpdating(true);
      try {
        if (next === 'delivered') {
          await markOrderDelivered(order.id);
        } else {
          await markOrderComplete(order.id);
        }
        haptic('heavy');
        toast.success(successMessage);
        queryClient.invalidateQueries({ queryKey: qk.orders.detail(order.id) });
        if (order.buyerId) {
          queryClient.invalidateQueries({ queryKey: qk.orders.byBuyer(order.buyerId) });
        }
        if (order.sellerId) {
          queryClient.invalidateQueries({ queryKey: qk.orders.bySeller(order.sellerId) });
        }
      } catch (err: any) {
        toast.error(err?.message ?? 'Update failed');
      } finally {
        setUpdating(false);
      }
    },
    [order, queryClient],
  );

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
                paddingBottom:
                  canMarkDelivered || canConfirmComplete
                    ? 200
                    : order.txSignature
                      ? 134
                      : 32,
                gap: 16,
              }}
            >
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pill intent={statusToIntent(order.status)} label={ucfirst(order.status)} />
                  <Pill intent="pink" label={order.type} />
                </View>
                <KPI size="md" amount={formatSol(order.amountSol)} unit="SOL" />
              </View>

              {/* Buyer/Seller (linkable) + Listing */}
              <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                {(
                  [
                    ['Buyer', order.buyerId, true],
                    ['Seller', order.sellerId, true],
                    ['Listing', order.listingId, false],
                  ] as const
                ).map(([label, value, linkable]) => {
                  const display = value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-4)}` : value;
                  const inner = (
                    <>
                      <ThemedText type="body-md" style={{ color: theme[500] }}>
                        {label}
                      </ThemedText>
                      <ThemedText
                        type="body-sm"
                        style={{ color: linkable ? theme[950] : theme[700] }}
                      >
                        {display}
                      </ThemedText>
                    </>
                  );
                  if (linkable) {
                    return (
                      <Pressable
                        key={label}
                        onPress={() => {
                          haptic('light');
                          router.push(`/profile/${value}`);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        {inner}
                      </Pressable>
                    );
                  }
                  return (
                    <View
                      key={label}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      {inner}
                    </View>
                  );
                })}
              </View>

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

              {order.status === 'complete' && (
                <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 12 }}>
                  <SectionLabel label="Reviews" />
                  {reviewsQuery.isLoading ? (
                    <ActivityIndicator color={theme[500]} />
                  ) : (
                    <View style={{ gap: 16 }}>
                      {myReview ? (
                        <View style={{ gap: 4 }}>
                          <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                            Your review
                          </ThemedText>
                          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                            {[1, 2, 3, 4, 5].map((n) => {
                              const filled = n <= meanRating(myReview);
                              return (
                                <Star
                                  key={n}
                                  size={14}
                                  color={filled ? theme[950] : theme[300]}
                                  fill={filled ? theme[950] : 'transparent'}
                                  strokeWidth={2}
                                />
                              );
                            })}
                          </View>
                          {myReview.comment ? (
                            <ThemedText type="body-sm" style={{ color: theme[700] }}>
                              {myReview.comment}
                            </ThemedText>
                          ) : null}
                        </View>
                      ) : null}

                      {theirReview ? (
                        <View style={{ gap: 4 }}>
                          <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                            {counterpartyLabel}&apos;s review
                          </ThemedText>
                          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                            {[1, 2, 3, 4, 5].map((n) => {
                              const filled = n <= meanRating(theirReview);
                              return (
                                <Star
                                  key={n}
                                  size={14}
                                  color={filled ? theme[950] : theme[300]}
                                  fill={filled ? theme[950] : 'transparent'}
                                  strokeWidth={2}
                                />
                              );
                            })}
                          </View>
                          {theirReview.comment ? (
                            <ThemedText type="body-sm" style={{ color: theme[700] }}>
                              {theirReview.comment}
                            </ThemedText>
                          ) : null}
                        </View>
                      ) : null}

                      {!myReview && !theirReview ? (
                        <ThemedText type="body-sm" style={{ color: theme[500] }}>
                          No reviews yet.
                        </ThemedText>
                      ) : null}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {(canMarkDelivered || canConfirmComplete || canLeaveReview) ? (
              <CtaFooter>
                <View style={{ gap: 8 }}>
                  {canMarkDelivered && (
                    <Button
                      title="Mark as delivered"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      loading={updating}
                      disabled={updating}
                      onPress={() => transitionTo('delivered', 'Marked as delivered')}
                    />
                  )}
                  {canConfirmComplete && (
                    <Button
                      title="Confirm receipt"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      loading={updating}
                      disabled={updating}
                      onPress={() => transitionTo('complete', 'Order complete')}
                    />
                  )}
                  {canLeaveReview && (
                    <Button
                      title="Leave a review"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onPress={() => {
                        haptic('light');
                        setReviewSheet(true);
                      }}
                    />
                  )}
                  {order.txSignature && (
                    <Button
                      title="View on Solana Explorer"
                      variant="secondary"
                      size="default"
                      className="w-full"
                      onPress={() => {
                        haptic('light');
                        Linking.openURL(explorerTxUrl(order.txSignature!));
                      }}
                    />
                  )}
                </View>
              </CtaFooter>
            ) : order.txSignature ? (
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
            ) : null}
          </>
        )}
      </SafeAreaView>

      {order && counterpartyId ? (
        <ReviewSheet
          visible={reviewSheet}
          onClose={() => setReviewSheet(false)}
          orderId={order.id}
          revieweeId={counterpartyId}
          revieweeLabel={counterpartyLabel}
        />
      ) : null}
    </ThemedView>
  );
}

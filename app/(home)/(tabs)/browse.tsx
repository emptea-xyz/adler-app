import React from 'react';
import { View, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { listActivePackages } from '@/lib/services/packageService';
import { listOpenGigs } from '@/lib/services/gigService';
import { FEED_KEYS } from '@/lib/constants/queryKeys';
import type { FeedItem } from '@/types/marketplace';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { EMPTY_BROWSE } from '@/lib/utils/copy';

export default function BrowseScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: FEED_KEYS.browse(),
    queryFn: async (): Promise<FeedItem[]> => {
      const [packages, gigs] = await Promise.all([
        listActivePackages({ limit: 50 }),
        listOpenGigs({ limit: 50 }),
      ]);
      const items: FeedItem[] = [
        ...packages.map((p) => ({ kind: 'package' as const, data: p })),
        ...gigs.map((g) => ({ kind: 'gig' as const, data: g })),
      ];
      items.sort((a, b) => b.data.createdAt - a.data.createdAt);
      return items;
    },
  });

  const onPressBalance = () => router.push('/settings/wallet');

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <AdlerHomeHeader onPressBalance={onPressBalance} />

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => `${item.kind}:${item.data.id}`}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 4,
              paddingBottom: TAB_BAR_HEIGHT + 32,
              gap: 10,
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme[500]}
              />
            }
            ListEmptyComponent={
              <View className="px-6 pt-12">
                <EmptyState title={EMPTY_BROWSE.title} description={EMPTY_BROWSE.description} />
              </View>
            }
            renderItem={({ item }) => {
              const amount =
                item.kind === 'package' ? item.data.priceSol : item.data.budgetSol;
              const kindLabel = item.kind === 'package' ? 'PACKAGE' : 'GIG';
              const accent = item.kind === 'package' ? theme[950] : theme[700];
              return (
                <Pressable
                  onPress={() => {
                    if (item.kind === 'package') router.push(`/package/${item.data.id}`);
                    else router.push(`/gig/${item.data.id}`);
                  }}
                >
                  <Card>
                    {/* F/Z scanning: price + kind in the top-left, status hint
                        on the right. Eye lands on the most decision-relevant
                        data first (cost, then "what is this"). */}
                    <View className="flex-row items-baseline gap-2">
                      <ThemedText type="body-xl-semibold">
                        {amount}
                      </ThemedText>
                      <ThemedText type="body-sm" style={{ color: theme[500] }}>
                        SOL
                      </ThemedText>
                      <View className="flex-1" />
                      <ThemedText
                        type="caption-semibold"
                        style={{ color: accent, letterSpacing: 0.6 }}
                      >
                        {kindLabel}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="body-md-semibold"
                      numberOfLines={2}
                      className="mt-2"
                    >
                      {item.data.title}
                    </ThemedText>
                    <ThemedText
                      type="body-sm"
                      numberOfLines={2}
                      className="mt-1"
                      style={{ color: theme[500] }}
                    >
                      {item.data.description}
                    </ThemedText>
                  </Card>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

import React from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedView } from '@/components/base/ThemedView';
import EmptyState from '@/components/ui/EmptyState';
import { ListingCard } from '@/components/ui/ListingCard';
import { FilterChip } from '@/components/ui/FilterChip';
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
        <AdlerHomeHeader title="Bazaar" onPressBalance={onPressBalance} />

        {/* Filter row — visual-only for v1 */}
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 16,
            marginTop: 8,
          }}
        >
          <FilterChip label="Sort by: Date" active />
          <FilterChip label="Category" />
          <FilterChip label="Price range" />
        </View>

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
              paddingTop: 14,
              paddingBottom: TAB_BAR_HEIGHT + 32,
              gap: 14,
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
              const ownerId = item.kind === 'package' ? item.data.sellerId : item.data.brandId;
              const amount = item.kind === 'package' ? item.data.priceSol : item.data.budgetSol;
              return (
                <ListingCard
                  kind={item.kind}
                  amount={amount}
                  category={item.data.category}
                  title={item.data.title}
                  ownerId={ownerId}
                  createdAt={item.data.createdAt}
                  onPress={() => {
                    if (item.kind === 'package') router.push(`/package/${item.data.id}`);
                    else router.push(`/gig/${item.data.id}`);
                  }}
                />
              );
            }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

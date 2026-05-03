import React, { useMemo, useState } from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedView } from '@/components/base/ThemedView';
import EmptyState from '@/components/ui/EmptyState';
import { ListingCard } from '@/components/ui/ListingCard';
import { FilterChip } from '@/components/ui/FilterChip';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { SortBySheet } from '@/components/features/browse/SortBySheet';
import { CategorySheet } from '@/components/features/browse/CategorySheet';
import { PriceRangeSheet } from '@/components/features/browse/PriceRangeSheet';
import {
  DEFAULT_FILTERS,
  PRICE_RANGE_CHIP_LABEL,
  PRICE_RANGE_OPTIONS,
  SORT_BY_CHIP_LABEL,
} from '@/components/features/browse/filterTypes';
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

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortSheet, setSortSheet] = useState(false);
  const [categorySheet, setCategorySheet] = useState(false);
  const [priceSheet, setPriceSheet] = useState(false);

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

  const filtered = useMemo(() => {
    if (!data) return [];
    const pricePredicate =
      PRICE_RANGE_OPTIONS.find((o) => o.id === filters.priceRange)?.predicate ?? (() => true);

    const matched = data.filter((item) => {
      if (filters.category && item.data.category !== filters.category) return false;
      const amount =
        item.kind === 'package' ? item.data.priceSol : item.data.budgetSol;
      if (!pricePredicate(amount)) return false;
      return true;
    });

    if (filters.sortBy === 'priceAsc' || filters.sortBy === 'priceDesc') {
      const dir = filters.sortBy === 'priceAsc' ? 1 : -1;
      matched.sort((a, b) => {
        const aAmount = a.kind === 'package' ? a.data.priceSol : a.data.budgetSol;
        const bAmount = b.kind === 'package' ? b.data.priceSol : b.data.budgetSol;
        return (aAmount - bAmount) * dir;
      });
    }
    // 'date' is the server-default order, leave as is.
    return matched;
  }, [data, filters]);

  const onPressBalance = () => router.push('/settings/wallet');

  const categoryChipLabel =
    filters.category === null
      ? 'Category'
      : filters.category.charAt(0).toUpperCase() + filters.category.slice(1);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <AdlerHomeHeader title="Bazaar" onPressBalance={onPressBalance} />

        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 16,
            marginTop: 8,
          }}
        >
          <FilterChip
            label={SORT_BY_CHIP_LABEL[filters.sortBy]}
            active={filters.sortBy !== 'date'}
            onPress={() => setSortSheet(true)}
          />
          <FilterChip
            label={categoryChipLabel}
            active={filters.category !== null}
            onPress={() => setCategorySheet(true)}
          />
          <FilterChip
            label={PRICE_RANGE_CHIP_LABEL[filters.priceRange]}
            active={filters.priceRange !== 'all'}
            onPress={() => setPriceSheet(true)}
          />
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => `${item.kind}:${item.data.id}`}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
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
              <View className="pt-12">
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

      <SortBySheet
        visible={sortSheet}
        value={filters.sortBy}
        onChange={(sortBy) => setFilters((f) => ({ ...f, sortBy }))}
        onClose={() => setSortSheet(false)}
      />
      <CategorySheet
        visible={categorySheet}
        value={filters.category}
        onChange={(category) => setFilters((f) => ({ ...f, category }))}
        onClose={() => setCategorySheet(false)}
      />
      <PriceRangeSheet
        visible={priceSheet}
        value={filters.priceRange}
        onChange={(priceRange) => setFilters((f) => ({ ...f, priceRange }))}
        onClose={() => setPriceSheet(false)}
      />
    </ThemedView>
  );
}

import React, { useMemo, useState } from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react-native';
import { ThemedView } from '@/components/base/ThemedView';
import EmptyState from '@/components/ui/EmptyState';
import { ListingCard } from '@/components/ui/ListingCard';
import { FilterChip } from '@/components/ui/FilterChip';
import TextInput from '@/components/ui/TextInput';
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
import { useDebounce } from '@/hooks/useDebounce';
import { listActivePackagesPage } from '@/lib/services/packageService';
import { listOpenGigsPage } from '@/lib/services/gigService';
import { FEED_KEYS } from '@/lib/constants/queryKeys';
import type { FeedItem } from '@/types/marketplace';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { EMPTY_BROWSE, EMPTY_BROWSE_SEARCH } from '@/lib/utils/copy';

const PAGE_SIZE = 25;

interface FeedPageParam {
  packagesCursor: number | null;
  gigsCursor: number | null;
}
const INITIAL_PAGE_PARAM: FeedPageParam = { packagesCursor: null, gigsCursor: null };

interface FeedPage {
  items: FeedItem[];
  next: FeedPageParam | null;
}

export default function BrowseScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebounce(searchInput.trim().toLowerCase(), 250);
  const [sortSheet, setSortSheet] = useState(false);
  const [categorySheet, setCategorySheet] = useState(false);
  const [priceSheet, setPriceSheet] = useState(false);

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<FeedPage, Error, FeedPage[], readonly unknown[], FeedPageParam>({
    queryKey: FEED_KEYS.browse(),
    initialPageParam: INITIAL_PAGE_PARAM,
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const cursors = pageParam ?? INITIAL_PAGE_PARAM;
      const [packagesPage, gigsPage] = await Promise.all([
        listActivePackagesPage({ limit: PAGE_SIZE, cursor: cursors.packagesCursor }),
        listOpenGigsPage({ limit: PAGE_SIZE, cursor: cursors.gigsCursor }),
      ]);
      const items: FeedItem[] = [
        ...packagesPage.items.map((p) => ({ kind: 'package' as const, data: p })),
        ...gigsPage.items.map((g) => ({ kind: 'gig' as const, data: g })),
      ];
      items.sort((a, b) => b.data.createdAt - a.data.createdAt);
      const noMore = !packagesPage.nextCursor && !gigsPage.nextCursor;
      return {
        items,
        next: noMore
          ? null
          : { packagesCursor: packagesPage.nextCursor, gigsCursor: gigsPage.nextCursor },
      };
    },
    getNextPageParam: (last) => last.next ?? undefined,
    select: (raw) => raw.pages,
  });

  const flatFeed = useMemo<FeedItem[]>(() => {
    if (!data) return [];
    return data.flatMap((p) => p.items);
  }, [data]);

  const filtered = useMemo(() => {
    if (!flatFeed.length) return [];
    const pricePredicate =
      PRICE_RANGE_OPTIONS.find((o) => o.id === filters.priceRange)?.predicate ?? (() => true);

    const matched = flatFeed.filter((item) => {
      if (filters.category && item.data.category !== filters.category) return false;
      const amount =
        item.kind === 'package' ? item.data.priceSol : item.data.budgetSol;
      if (!pricePredicate(amount)) return false;
      if (debouncedQuery) {
        const haystack = `${item.data.title} ${item.data.description}`.toLowerCase();
        if (!haystack.includes(debouncedQuery)) return false;
      }
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
  }, [flatFeed, filters, debouncedQuery]);

  const categoryChipLabel =
    filters.category === null
      ? 'Category'
      : filters.category.charAt(0).toUpperCase() + filters.category.slice(1);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <AdlerHomeHeader title="Marketplace" />

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search packages and gigs"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            leftIcon={<Search size={16} color={theme[500]} strokeWidth={2} />}
          />
        </View>

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
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator color={theme[500]} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View className="pt-12">
                {(() => {
                  // Distinguish "no listings exist" from "user's filter narrows it to zero".
                  const hasFilter =
                    !!debouncedQuery ||
                    filters.category !== null ||
                    filters.priceRange !== 'all';
                  const haveAnyData = (flatFeed?.length ?? 0) > 0;
                  const empty = hasFilter && haveAnyData ? EMPTY_BROWSE_SEARCH : EMPTY_BROWSE;
                  return <EmptyState title={empty.title} description={empty.description} />;
                })()}
              </View>
            }
            renderItem={({ item }) => {
              const ownerId = item.kind === 'package' ? item.data.sellerId : item.data.brandId;
              const amount = item.kind === 'package' ? item.data.priceSol : item.data.budgetSol;
              const mediaUrls =
                item.kind === 'package' ? item.data.mediaUrls : undefined;
              const coverImageUrl =
                item.kind === 'package' ? item.data.coverImageUrl : undefined;
              return (
                <ListingCard
                  kind={item.kind}
                  amount={amount}
                  category={item.data.category}
                  title={item.data.title}
                  ownerId={ownerId}
                  createdAt={item.data.createdAt}
                  coverImageUrl={coverImageUrl}
                  mediaUrls={mediaUrls}
                  listingId={item.data.id}
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

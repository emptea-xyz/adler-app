import React, { useMemo } from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { ThemedView } from '@/components/base/ThemedView';
import EmptyState from '@/components/ui/EmptyState';
import { ListingCard } from '@/components/ui/ListingCard';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useSaves } from '@/hooks/useSaves';
import { getListing } from '@/lib/services/listingsService';
import { qk } from '@/lib/constants/queryKeys';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { EMPTY_SAVED } from '@/lib/utils/copy';
import type { Gig, SavedKind, Service } from '@/types/marketplace';

interface ResolvedSaveBase {
  saveId: string;
  kind: SavedKind;
  listingId: string;
}
type ResolvedService = ResolvedSaveBase & { kind: 'service'; data: Service };
type ResolvedGig = ResolvedSaveBase & { kind: 'gig'; data: Gig };
type ResolvedSave = ResolvedService | ResolvedGig;

export default function SavedScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { saves, isLoading: savesLoading } = useSaves();
  const queryClient = useQueryClient();

  // Fan out per-listing fetches. React Query dedupes/caches so navigating
  // to Browse → Saved doesn't refetch the same docs.
  const listingQueries = useQueries({
    queries: saves.map((s) => ({
      queryKey: qk.listings.detail(s.kind, s.listingId),
      queryFn: () => getListing(s.kind, s.listingId),
      staleTime: 60_000,
    })),
  });

  const items = useMemo<ResolvedSave[]>(() => {
    return saves
      .map((s, i): ResolvedSave | null => {
        const data = listingQueries[i]?.data;
        if (!data) return null;
        if (s.kind === 'service' && data.kind === 'service') {
          return {
            saveId: s.id,
            kind: 'service',
            listingId: s.listingId,
            data,
          };
        }
        if (s.kind === 'gig' && data.kind === 'gig') {
          return {
            saveId: s.id,
            kind: 'gig',
            listingId: s.listingId,
            data,
          };
        }
        return null;
      })
      .filter((x): x is ResolvedSave => x !== null);
  }, [saves, listingQueries]);

  const refreshing = savesLoading || listingQueries.some((q) => q.isFetching);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['saves'] });
    listingQueries.forEach((q) => q.refetch());
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <AdlerHomeHeader title="Saved" />

        {savesLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.saveId}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: TAB_BAR_HEIGHT + 32,
              gap: 14,
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={theme[500]} />
            }
            ListEmptyComponent={
              <View className="pt-12">
                <EmptyState title={EMPTY_SAVED.title} description={EMPTY_SAVED.description} />
              </View>
            }
            renderItem={({ item }) => {
              const ownerId =
                item.kind === 'service' ? item.data.sellerId : item.data.brandId;
              const amount =
                item.kind === 'service' ? item.data.priceSol : item.data.budgetSol;
              return (
                <ListingCard
                  kind={item.kind}
                  amount={amount}
                  category={item.data.category}
                  title={item.data.title}
                  ownerId={ownerId}
                  createdAt={item.data.createdAt}
                  mediaUrls={item.data.mediaUrls}
                  overlay={item.kind === 'service' ? item.data.overlay : null}
                  listingId={item.listingId}
                  onPress={() => {
                    if (item.kind === 'service') router.push(`/service/${item.listingId}`);
                    else router.push(`/gig/${item.listingId}`);
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

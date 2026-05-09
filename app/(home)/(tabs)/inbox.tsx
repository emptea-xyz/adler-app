import React, { useCallback, useMemo, useState } from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useInboxUnread } from '@/hooks/useInboxUnread';
import { ThemedView } from '@/components/base/ThemedView';
import EmptyState from '@/components/ui/EmptyState';
import { UnderlineTabBar } from '@/components/ui/UnderlineTabBar';
import { InboxRow } from '@/components/ui/InboxRow';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  listOrdersAsBuyer,
  listOrdersAsSeller,
} from '@/lib/services/ordersService';
import {
  listApplicationsByBrand,
  listApplicationsByCreator,
} from '@/lib/services/applicationsService';
import { listMyListings } from '@/lib/services/listingsService';
import { qk } from '@/lib/constants/queryKeys';
import { formatSol } from '@/lib/utils/formatNumber';
import { formatRelative } from '@/lib/utils/dates';
import { viewModeFor } from '@/lib/utils/role';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import type { Gig, GigApplication, Order } from '@/types/marketplace';
import {
  EMPTY_INBOX_APPLICATIONS,
  EMPTY_INBOX_PURCHASES,
  EMPTY_INBOX_SALES,
  EMPTY_GIGS_BY_BRAND,
  EMPTY_GIG_APPLICATIONS,
} from '@/lib/utils/copy';

const CREATOR_TABS = ['Sales', 'Applications'] as const;
const BRAND_TABS = ['Purchases', 'Posted', 'Applications'] as const;
type CreatorTab = typeof CREATOR_TABS[number];
type BrandTab = typeof BRAND_TABS[number];

export default function InboxScreen() {
  const { user } = useAuth();
  const { profile } = useUser();
  const { theme } = useTheme();
  const router = useRouter();
  const { markSeen } = useInboxUnread();

  // Mark the inbox as seen each time the tab gains focus — clears the
  // unread dot in `AdlerTabBar`.
  useFocusEffect(
    useCallback(() => {
      markSeen().catch(() => null);
    }, [markSeen]),
  );

  const isCreator = viewModeFor(profile) === 'creator';
  const tabs = isCreator ? CREATOR_TABS : BRAND_TABS;
  const [activeTab, setActiveTab] = useState<CreatorTab | BrandTab>(tabs[0]);

  const ordersAsBuyerQuery = useQuery({
    queryKey: user ? qk.orders.byBuyer(user.id) : ['orders', 'byBuyer', 'anon'],
    enabled: !!user && !isCreator,
    queryFn: () => listOrdersAsBuyer(user!.id),
  });

  const ordersAsSellerQuery = useQuery({
    queryKey: user ? qk.orders.bySeller(user.id) : ['orders', 'bySeller', 'anon'],
    enabled: !!user && isCreator,
    queryFn: () => listOrdersAsSeller(user!.id),
  });

  const applicationsQuery = useQuery({
    queryKey: user ? qk.applications.byCreator(user.id) : ['applications', 'byCreator', 'anon'],
    enabled: !!user && isCreator,
    queryFn: () => listApplicationsByCreator(user!.id),
  });

  const postedGigsQuery = useQuery({
    queryKey: user ? qk.listings.byOwner('gig', user.id) : ['listings', 'byOwner', 'gig', 'anon'],
    enabled: !!user && !isCreator,
    queryFn: () => listMyListings('gig', user!.id),
  });

  // Brand-side applications query goes through the denormalized `brandId`
  // field on each application — single Firestore query, no per-gig fan-out.
  const brandApplicationsQuery = useQuery({
    queryKey: user ? qk.applications.byBrand(user.id) : ['applications', 'byBrand', 'anon'],
    enabled: !!user && !isCreator,
    queryFn: () => listApplicationsByBrand(user!.id),
  });

  type Row = { id: string; title: string; subtitle: string; href: string };

  const { items, loading, refetch, refreshing, emptyTitle, emptyDescription } = useMemo<{
    items: Row[];
    loading: boolean;
    refetch: () => void;
    refreshing: boolean;
    emptyTitle: string;
    emptyDescription: string;
  }>(() => {
    if (isCreator) {
      if (activeTab === 'Sales') {
        return {
          items: (ordersAsSellerQuery.data ?? []).map((o: Order) => ({
            id: o.id,
            title: `${o.status === 'failed' ? '[FAILED] ' : ''}Sale · ${formatSol(o.amountSol)} SOL`,
            subtitle: `${o.type} · ${o.status} · ${formatRelative(o.createdAt)}`,
            href: `/order/${o.id}`,
          })),
          loading: ordersAsSellerQuery.isLoading,
          refetch: ordersAsSellerQuery.refetch,
          refreshing: ordersAsSellerQuery.isRefetching,
          emptyTitle: EMPTY_INBOX_SALES.title,
          emptyDescription: EMPTY_INBOX_SALES.description,
        };
      }
      return {
        items: (applicationsQuery.data ?? []).map((a: GigApplication) => ({
          id: a.id,
          title: `Applied · ${a.status}`,
          subtitle: `${a.message.slice(0, 80)} · ${formatRelative(a.createdAt)}`,
          href: `/gig/${a.gigId}`,
        })),
        loading: applicationsQuery.isLoading,
        refetch: applicationsQuery.refetch,
        refreshing: applicationsQuery.isRefetching,
        emptyTitle: EMPTY_INBOX_APPLICATIONS.title,
        emptyDescription: EMPTY_INBOX_APPLICATIONS.description,
      };
    }

    // Brand
    if (activeTab === 'Posted') {
      return {
        items: (postedGigsQuery.data ?? []).map((g) => {
          const gig = g as Gig;
          return {
            id: gig.id,
            title: gig.title,
            subtitle: `Gig · ${gig.status} · ${formatSol(gig.budgetSol)} SOL · ${formatRelative(gig.createdAt)}`,
            href: `/gig/${gig.id}`,
          };
        }),
        loading: postedGigsQuery.isLoading,
        refetch: postedGigsQuery.refetch,
        refreshing: postedGigsQuery.isRefetching,
        emptyTitle: EMPTY_GIGS_BY_BRAND.title,
        emptyDescription: EMPTY_GIGS_BY_BRAND.description,
      };
    }
    if (activeTab === 'Applications') {
      return {
        items: (brandApplicationsQuery.data ?? []).map((a: GigApplication) => ({
          id: a.id,
          title: `Application · ${a.status}`,
          subtitle: `${a.gigTitle ?? 'Gig'} · ${formatRelative(a.createdAt)}`,
          href: `/gig/${a.gigId}`,
        })),
        loading: brandApplicationsQuery.isLoading,
        refetch: brandApplicationsQuery.refetch,
        refreshing: brandApplicationsQuery.isRefetching,
        emptyTitle: EMPTY_GIG_APPLICATIONS.title,
        emptyDescription: EMPTY_GIG_APPLICATIONS.description,
      };
    }
    // Purchases
    return {
      items: (ordersAsBuyerQuery.data ?? []).map((o: Order) => ({
        id: o.id,
        title: `${o.status === 'failed' ? '[FAILED] ' : ''}Purchase · ${formatSol(o.amountSol)} SOL`,
        subtitle: `${o.type} · ${o.status} · ${formatRelative(o.createdAt)}`,
        href: `/order/${o.id}`,
      })),
      loading: ordersAsBuyerQuery.isLoading,
      refetch: ordersAsBuyerQuery.refetch,
      refreshing: ordersAsBuyerQuery.isRefetching,
      emptyTitle: EMPTY_INBOX_PURCHASES.title,
      emptyDescription: EMPTY_INBOX_PURCHASES.description,
    };
  }, [
    isCreator,
    activeTab,
    ordersAsBuyerQuery,
    ordersAsSellerQuery,
    applicationsQuery,
    postedGigsQuery,
    brandApplicationsQuery,
  ]);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <AdlerHomeHeader title="Activity" />

        {tabs.length > 1 && (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <UnderlineTabBar
              tabs={tabs as readonly string[]}
              activeTab={activeTab as string}
              onTabChange={(t) => setActiveTab(t as CreatorTab | BrandTab)}
            />
          </View>
        )}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: TAB_BAR_HEIGHT + 32,
              gap: 16,
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={theme[500]} />
            }
            ListEmptyComponent={
              <View className="pt-12">
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </View>
            }
            renderItem={({ item }) => (
              <InboxRow
                title={item.title}
                subline={item.subtitle}
                onPress={() => router.push(item.href as any)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

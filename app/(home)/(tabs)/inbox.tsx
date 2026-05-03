import React, { useMemo, useState } from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedView } from '@/components/base/ThemedView';
import EmptyState from '@/components/ui/EmptyState';
import { UnderlineTabBar } from '@/components/ui/UnderlineTabBar';
import { InboxRow } from '@/components/ui/InboxRow';
import { AdlerHomeHeader } from '@/components/features/home/AdlerHomeHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { listOrdersByBuyer, listOrdersBySeller } from '@/lib/services/orderService';
import { listApplicationsByCreator } from '@/lib/services/applicationService';
import { ORDER_KEYS, APPLICATION_KEYS } from '@/lib/constants/queryKeys';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import {
  EMPTY_INBOX_APPLICATIONS,
  EMPTY_INBOX_PURCHASES,
  EMPTY_INBOX_SALES,
} from '@/lib/utils/copy';

const CREATOR_TABS = ['Sales', 'Applications'] as const;
const BRAND_TABS = ['Purchases'] as const;
type CreatorTab = typeof CREATOR_TABS[number];
type BrandTab = typeof BRAND_TABS[number];

export default function InboxScreen() {
  const { user } = useAuth();
  const { profile } = useUser();
  const { theme } = useTheme();
  const router = useRouter();

  const isCreator = profile?.role === 'creator';
  const tabs = isCreator ? CREATOR_TABS : BRAND_TABS;
  const [activeTab, setActiveTab] = useState<CreatorTab | BrandTab>(tabs[0]);

  const ordersAsBuyerQuery = useQuery({
    queryKey: user ? ORDER_KEYS.asBuyer(user.id) : ['orders', 'buyer', 'anon'],
    enabled: !!user && !isCreator,
    queryFn: () => listOrdersByBuyer(user!.id),
  });

  const ordersAsSellerQuery = useQuery({
    queryKey: user ? ORDER_KEYS.asSeller(user.id) : ['orders', 'seller', 'anon'],
    enabled: !!user && isCreator,
    queryFn: () => listOrdersBySeller(user!.id),
  });

  const applicationsQuery = useQuery({
    queryKey: user ? APPLICATION_KEYS.byCreator(user.id) : ['applications', 'creator', 'anon'],
    enabled: !!user && isCreator,
    queryFn: () => listApplicationsByCreator(user!.id),
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
          items: (ordersAsSellerQuery.data ?? []).map((o) => ({
            id: o.id,
            title: `Sale · ${o.amountSol} SOL`,
            subtitle: `${o.type} · ${o.status}`,
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
        items: (applicationsQuery.data ?? []).map((a) => ({
          id: a.id,
          title: `Applied · ${a.status}`,
          subtitle: a.message.slice(0, 80),
          href: `/gig/${a.gigId}`,
        })),
        loading: applicationsQuery.isLoading,
        refetch: applicationsQuery.refetch,
        refreshing: applicationsQuery.isRefetching,
        emptyTitle: EMPTY_INBOX_APPLICATIONS.title,
        emptyDescription: EMPTY_INBOX_APPLICATIONS.description,
      };
    }
    return {
      items: (ordersAsBuyerQuery.data ?? []).map((o) => ({
        id: o.id,
        title: `Purchase · ${o.amountSol} SOL`,
        subtitle: `${o.type} · ${o.status}`,
        href: `/order/${o.id}`,
      })),
      loading: ordersAsBuyerQuery.isLoading,
      refetch: ordersAsBuyerQuery.refetch,
      refreshing: ordersAsBuyerQuery.isRefetching,
      emptyTitle: EMPTY_INBOX_PURCHASES.title,
      emptyDescription: EMPTY_INBOX_PURCHASES.description,
    };
  }, [isCreator, activeTab, ordersAsBuyerQuery, ordersAsSellerQuery, applicationsQuery]);

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

import React, { useMemo, useState } from 'react';
import { View, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { UnderlineTabBar } from '@/components/ui/UnderlineTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { listOrdersByBuyer, listOrdersBySeller } from '@/lib/services/orderService';
import { listApplicationsByCreator } from '@/lib/services/applicationService';
import { ORDER_KEYS, APPLICATION_KEYS } from '@/lib/constants/queryKeys';

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

  type InboxRow = { id: string; title: string; subtitle: string; href: string };

  const { items, loading, refetch, refreshing } = useMemo<{
    items: InboxRow[];
    loading: boolean;
    refetch: () => void;
    refreshing: boolean;
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
    };
  }, [isCreator, activeTab, ordersAsBuyerQuery, ordersAsSellerQuery, applicationsQuery]);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-6 pt-4 pb-2">
          <ThemedText type="h3">Inbox</ThemedText>
        </View>

        {tabs.length > 1 && (
          <View className="px-4">
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
            contentContainerStyle={{ padding: 16, gap: 12 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={theme[500]} />
            }
            ListEmptyComponent={
              <View className="px-6 pt-12">
                <EmptyState
                  title="Nothing here yet"
                  description="Your activity will show up here."
                />
              </View>
            }
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(item.href as any)}>
                <Card>
                  <ThemedText type="body-lg-semibold">{item.title}</ThemedText>
                  <ThemedText
                    type="body-sm"
                    numberOfLines={2}
                    className="mt-1"
                    style={{ color: theme[500] }}
                  >
                    {item.subtitle}
                  </ThemedText>
                </Card>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

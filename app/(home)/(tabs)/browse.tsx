import React from 'react';
import { View, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { useTheme } from '@/contexts/ThemeContext';
import { listActivePackages } from '@/lib/services/packageService';
import { listOpenGigs } from '@/lib/services/gigService';
import { FEED_KEYS } from '@/lib/constants/queryKeys';
import type { FeedItem } from '@/types/marketplace';

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

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-6 pt-4 pb-2">
          <ThemedText type="h3">Browse</ThemedText>
          <ThemedText type="body-sm" style={{ color: theme[500] }}>
            Packages and gigs from the network
          </ThemedText>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => `${item.kind}:${item.data.id}`}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme[500]}
              />
            }
            ListEmptyComponent={
              <View className="px-6 pt-12">
                <EmptyState
                  title="Nothing here yet"
                  description="When creators list packages and brands post gigs, they'll show up here."
                />
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  if (item.kind === 'package') router.push(`/package/${item.data.id}`);
                  else router.push(`/gig/${item.data.id}`);
                }}
              >
                <Card>
                  <View className="flex-row items-center justify-between mb-1">
                    <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                      {item.kind === 'package' ? 'PACKAGE' : 'GIG'}
                    </ThemedText>
                    <ThemedText type="body-sm-semibold">
                      {item.kind === 'package'
                        ? `${item.data.priceSol} SOL`
                        : `${item.data.budgetSol} SOL`}
                    </ThemedText>
                  </View>
                  <ThemedText type="body-lg-semibold" numberOfLines={2}>
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
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

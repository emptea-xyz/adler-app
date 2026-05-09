import React, { useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { ListingCard } from '@/components/ui/ListingCard';
import EmptyState from '@/components/ui/EmptyState';
import { ProfileHeader } from '@/components/features/profile/ProfileHeader';
import { EditProfileSheet } from '@/components/features/profile/EditProfileSheet';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { listMyListings } from '@/lib/services/listingsService';
import { qk } from '@/lib/constants/queryKeys';
import { haptic } from '@/lib/utils/haptic';
import { viewModeFor } from '@/lib/utils/role';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import {
  EMPTY_PACKAGES_BY_SELLER,
  EMPTY_GIGS_BY_BRAND,
} from '@/lib/utils/copy';
import type { Gig, Service } from '@/types/marketplace';

const LISTINGS_PREVIEW_LIMIT = 6;

export default function ProfileScreen() {
  const { profile } = useUser();
  const { theme } = useTheme();
  const router = useRouter();
  const { openCreate } = useOverlaySheets();
  const [editOpen, setEditOpen] = useState(false);

  const isCreator = viewModeFor(profile) === 'creator';

  const servicesQuery = useQuery({
    queryKey: profile?.id ? qk.listings.byOwner('service', profile.id) : ['listings', 'byOwner', 'service', 'anon'],
    enabled: !!profile?.id && isCreator,
    queryFn: () => listMyListings('service', profile!.id),
  });

  const gigsQuery = useQuery({
    queryKey: profile?.id ? qk.listings.byOwner('gig', profile.id) : ['listings', 'byOwner', 'gig', 'anon'],
    enabled: !!profile?.id && !isCreator,
    queryFn: () => listMyListings('gig', profile!.id),
  });

  const listings = isCreator ? servicesQuery.data ?? [] : gigsQuery.data ?? [];
  const listingsLoading = isCreator ? servicesQuery.isLoading : gigsQuery.isLoading;
  const listingsTitle = isCreator ? 'Your services' : 'Your gigs';
  const listingsEmpty = isCreator ? EMPTY_PACKAGES_BY_SELLER : EMPTY_GIGS_BY_BRAND;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: TAB_BAR_HEIGHT + 32,
            gap: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <ProfileHeader
            listingsCount={listings.length}
            onPressEdit={() => setEditOpen(true)}
          />

          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <SectionLabel label={listingsTitle} />
              {listings.length > 0 ? (
                <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                  {listings.length}
                </ThemedText>
              ) : null}
            </View>

            {listingsLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={theme[500]} />
              </View>
            ) : listings.length === 0 ? (
              <View style={{ gap: 12, paddingTop: 8 }}>
                <EmptyState
                  title={listingsEmpty.title}
                  description={listingsEmpty.description}
                />
                <Button
                  title={isCreator ? 'List a service' : 'Post a gig'}
                  onPress={() => {
                    haptic('light');
                    if (isCreator) {
                      openCreate();
                      return;
                    }
                    router.push('/gigs/new');
                  }}
                  variant="secondary"
                  className="self-center"
                />
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                {listings.slice(0, LISTINGS_PREVIEW_LIMIT).map((item) => {
                  const amount = isCreator
                    ? (item as Service).priceSol
                    : (item as Gig).budgetSol;
                  return (
                    <ListingCard
                      key={item.id}
                      kind={isCreator ? 'service' : 'gig'}
                      amount={amount}
                      category={item.category}
                      title={item.title}
                      ownerId={profile?.id ?? ''}
                      createdAt={item.createdAt}
                      mediaUrls={item.mediaUrls}
                      onPress={() => {
                        haptic('light');
                        router.push(
                          isCreator ? `/service/${item.id}` : `/gig/${item.id}`,
                        );
                      }}
                    />
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <EditProfileSheet visible={editOpen} onClose={() => setEditOpen(false)} />
    </ThemedView>
  );
}

import React from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { ListingCard } from '@/components/ui/ListingCard';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getProfile } from '@/lib/services/profileService';
import { listMyListings } from '@/lib/services/listingsService';
import { qk } from '@/lib/constants/queryKeys';
import { haptic } from '@/lib/utils/haptic';
import { viewModeFor } from '@/lib/utils/role';
import type { Gig, Service } from '@/types/marketplace';
import {
  EMPTY_PACKAGES_BY_SELLER,
  EMPTY_GIGS_BY_BRAND,
} from '@/lib/utils/copy';

const AVATAR_PX = 88;

function formatJoinedDate(ms: number): string {
  return new Date(ms).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function ucfirst(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  // Tapping your own @username should land on the dashboard, not a read-only
  // mirror. Compute as a flag and short-circuit *after* hooks below — keeping
  // the early return above the hook calls violates rules-of-hooks.
  const redirectToOwnProfile = !!user && id === user.id;

  const profileQuery = useQuery({
    queryKey: id ? qk.profiles.detail(id) : ['profiles', 'detail', 'unknown'],
    enabled: !!id && !redirectToOwnProfile,
    queryFn: () => getProfile(id!),
  });

  const profile = profileQuery.data;
  const role = viewModeFor(profile);
  const isCreator = role === 'creator';

  const servicesQuery = useQuery({
    queryKey: profile?.id ? qk.listings.byOwner('service', profile.id) : ['listings', 'byOwner', 'service', 'anon'],
    enabled: !!profile?.id && isCreator && !redirectToOwnProfile,
    queryFn: () => listMyListings('service', profile!.id),
  });

  const gigsQuery = useQuery({
    queryKey: profile?.id ? qk.listings.byOwner('gig', profile.id) : ['listings', 'byOwner', 'gig', 'anon'],
    enabled: !!profile?.id && !isCreator && !redirectToOwnProfile,
    queryFn: () => listMyListings('gig', profile!.id),
  });

  if (redirectToOwnProfile) {
    return <Redirect href="/(home)/(tabs)/profile" />;
  }

  const listings = isCreator ? servicesQuery.data ?? [] : gigsQuery.data ?? [];
  const listingsLoading = isCreator ? servicesQuery.isLoading : gigsQuery.isLoading;
  const listingsTitle = isCreator ? 'Services' : 'Gigs';
  const listingsEmpty = isCreator ? EMPTY_PACKAGES_BY_SELLER : EMPTY_GIGS_BY_BRAND;
  const joined = profile?.createdAt ? formatJoinedDate(profile.createdAt) : null;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader title="Profile" onBack={() => router.back()} />

        {profileQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : !profile ? (
          <View className="flex-1 items-center justify-center px-4">
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              Profile not found.
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 32,
              gap: 24,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: 'center', gap: 8, paddingTop: 12 }}>
              <View style={{ width: AVATAR_PX, height: AVATAR_PX, borderRadius: AVATAR_PX / 2, overflow: 'hidden' }}>
                <Avatar
                  avatarUrl={profile.avatarUrl}
                  size="lg"
                  initial={profile.displayName?.[0]}
                />
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <ThemedText
                  type="body-2xl-semibold"
                  style={{ color: theme[950] }}
                  numberOfLines={1}
                >
                  {profile.displayName}
                </ThemedText>
                <ThemedText type="body-sm" style={{ color: theme[500] }} numberOfLines={1}>
                  @{profile.username}
                </ThemedText>
              </View>

              {role ? (
                <View style={{ marginTop: 2 }}>
                  <Pill intent="dark" label={ucfirst(role)} />
                </View>
              ) : null}

              {profile.bio ? (
                <ThemedText
                  type="body-sm"
                  align="center"
                  style={{ color: theme[700], marginTop: 4, paddingHorizontal: 8 }}
                >
                  {profile.bio}
                </ThemedText>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <ThemedText type="body-xs" style={{ color: theme[500] }}>
                  {listings.length} {isCreator ? 'service' : 'gig'}{listings.length === 1 ? '' : 's'}
                </ThemedText>
                {joined ? (
                  <>
                    <ThemedText type="body-xs" style={{ color: theme[500] }}>
                      ·
                    </ThemedText>
                    <ThemedText type="body-xs" style={{ color: theme[500] }}>
                      Joined {joined}
                    </ThemedText>
                  </>
                ) : null}
              </View>
            </View>

            <View style={{ gap: 12 }}>
              <SectionLabel label={listingsTitle} />

              {listingsLoading ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={theme[500]} />
                </View>
              ) : listings.length === 0 ? (
                <View style={{ paddingTop: 8 }}>
                  <EmptyState
                    title={listingsEmpty.title}
                    description={listingsEmpty.description}
                  />
                </View>
              ) : (
                <View style={{ gap: 14 }}>
                  {listings.map((item) => {
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
                        ownerId={profile.id}
                        createdAt={item.createdAt}
                        mediaUrls={item.mediaUrls}
                        listingId={item.id}
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
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

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
import { Button } from '@/components/ui/Button';
import { ListingCard } from '@/components/ui/ListingCard';
import { CtaFooter } from '@/components/ui/CtaFooter';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getProfile } from '@/lib/services/profileService';
import { listPackagesBySeller } from '@/lib/services/packageService';
import { listGigsByBrand } from '@/lib/services/gigService';
import { PROFILE_KEYS, PACKAGE_KEYS, GIG_KEYS } from '@/lib/constants/queryKeys';
import { haptic } from '@/lib/utils/haptic';
import { toast } from '@/lib/utils/toast';
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

  // Tapping your own @username anywhere in the app should land you on the
  // dashboard view, not a read-only mirror of the same data.
  if (user && id === user.id) {
    return <Redirect href="/(home)/(tabs)/profile" />;
  }

  const profileQuery = useQuery({
    queryKey: id ? PROFILE_KEYS.profile(id) : ['profile', 'unknown'],
    enabled: !!id,
    queryFn: () => getProfile(id!),
  });

  const profile = profileQuery.data;
  const isCreator = profile?.role === 'creator';

  const packagesQuery = useQuery({
    queryKey: profile?.id ? PACKAGE_KEYS.bySeller(profile.id) : ['packages', 'seller', 'anon'],
    enabled: !!profile?.id && isCreator,
    queryFn: () => listPackagesBySeller(profile!.id),
  });

  const gigsQuery = useQuery({
    queryKey: profile?.id ? GIG_KEYS.byBrand(profile.id) : ['gigs', 'brand', 'anon'],
    enabled: !!profile?.id && !isCreator,
    queryFn: () => listGigsByBrand(profile!.id),
  });

  const listings = isCreator ? packagesQuery.data ?? [] : gigsQuery.data ?? [];
  const listingsLoading = isCreator ? packagesQuery.isLoading : gigsQuery.isLoading;
  const listingsTitle = isCreator ? 'Packages' : 'Gigs';
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
          <>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 134,
                gap: 24,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Centered identity block */}
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

                {profile.role ? (
                  <View style={{ marginTop: 2 }}>
                    <Pill intent="dark" label={ucfirst(profile.role)} />
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
                    {listings.length} {isCreator ? 'package' : 'gig'}{listings.length === 1 ? '' : 's'}
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

              {/* Listings */}
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
                      const isPackage = isCreator;
                      const amount = isPackage
                        ? (item as any).priceSol
                        : (item as any).budgetSol;
                      const mediaUrls = isPackage ? (item as any).mediaUrls : undefined;
                      return (
                        <ListingCard
                          key={item.id}
                          kind={isPackage ? 'package' : 'gig'}
                          amount={amount}
                          category={item.category}
                          title={item.title}
                          ownerId={profile.id}
                          createdAt={item.createdAt}
                          mediaUrls={mediaUrls}
                          onPress={() => {
                            haptic('light');
                            router.push(
                              isPackage ? `/package/${item.id}` : `/gig/${item.id}`,
                            );
                          }}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>

            <CtaFooter>
              <Button
                title="Contact"
                onPress={() => {
                  haptic('light');
                  toast.info('Messaging is coming soon');
                }}
                variant="primary"
                size="lg"
                className="w-full"
              />
            </CtaFooter>
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

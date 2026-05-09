import React, { useMemo, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Camera } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { ListingCard } from '@/components/ui/ListingCard';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { EditProfileSheet } from '@/components/features/profile/EditProfileSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getProfile } from '@/lib/services/profileService';
import { getProfileByHandle } from '@/lib/services/directoryService';
import { listMyListings } from '@/lib/services/listingsService';
import { aggregate, listReviewsByReviewee } from '@/lib/services/reviewsService';
import { qk } from '@/lib/constants/queryKeys';
import { haptic } from '@/lib/utils/haptic';
import { PLATFORM_LABEL, socialLinkUrl } from '@/lib/utils/socialLinks';
import { formatSol } from '@/lib/utils/formatNumber';
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

function parseProfileParam(value: string | undefined): {
  raw: string;
  handle: string;
  explicitHandle: boolean;
} {
  const raw = decodeURIComponent(value ?? '').trim();
  const explicitHandle = raw.startsWith('@');
  const handle = raw.replace(/^@/, '').toLowerCase();
  return { raw, handle, explicitHandle };
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const parsed = parseProfileParam(id);

  const profileQuery = useQuery({
    queryKey: parsed.raw ? ['profiles', 'public', parsed.raw] : ['profiles', 'public', 'unknown'],
    enabled: !!parsed.raw,
    queryFn: async () => {
      if (parsed.explicitHandle) {
        return getProfileByHandle(parsed.handle);
      }
      const direct = await getProfile(parsed.raw);
      if (direct) return direct;
      return getProfileByHandle(parsed.handle);
    },
  });

  const profile = profileQuery.data;
  const isOwnProfile = !!user && profile?.id === user.id;

  const servicesQuery = useQuery({
    queryKey: profile?.id ? qk.listings.byOwner('service', profile.id) : ['listings', 'byOwner', 'service', 'anon'],
    enabled: !!profile?.id && profile.isCreator,
    queryFn: () => listMyListings('service', profile!.id),
  });

  const gigsQuery = useQuery({
    queryKey: profile?.id ? qk.listings.byOwner('gig', profile.id) : ['listings', 'byOwner', 'gig', 'anon'],
    enabled: !!profile?.id && profile.isBrand,
    queryFn: () => listMyListings('gig', profile!.id),
  });

  const reviewsQuery = useQuery({
    queryKey: profile?.id ? qk.reviews.byReviewee(profile.id) : ['reviews', 'byReviewee', 'anon'],
    enabled: !!profile?.id,
    queryFn: () => listReviewsByReviewee(profile!.id),
  });

  const reputation = useMemo(
    () => aggregate(reviewsQuery.data ?? []),
    [reviewsQuery.data],
  );

  const services = servicesQuery.data ?? [];
  const gigs = gigsQuery.data ?? [];
  const joined = profile?.createdAt ? formatJoinedDate(profile.createdAt) : null;

  const renderListing = (item: Service | Gig) => {
    const isService = item.kind === 'service';
    const amount = isService ? item.priceSol : item.budgetSol;
    return (
      <ListingCard
        key={item.id}
        kind={item.kind}
        amount={amount}
        category={item.category}
        title={item.title}
        ownerId={profile?.id ?? ''}
        createdAt={item.createdAt}
        mediaUrls={item.mediaUrls}
        overlay={isService ? item.overlay : null}
        listingId={item.id}
        onPress={() => {
          haptic('light');
          router.push(isService ? `/service/${item.id}` : `/gig/${item.id}`);
        }}
      />
    );
  };

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

              {profile.isCreator || profile.isBrand ? (
                <View style={{ marginTop: 2, flexDirection: 'row', gap: 8 }}>
                  {profile.isCreator ? <Pill intent="dark" label={ucfirst('creator')} /> : null}
                  {profile.isBrand ? <Pill intent="neutral" label={ucfirst('brand')} /> : null}
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
                  {services.length} service{services.length === 1 ? '' : 's'}
                </ThemedText>
                <ThemedText type="body-xs" style={{ color: theme[500] }}>
                  ·
                </ThemedText>
                <ThemedText type="body-xs" style={{ color: theme[500] }}>
                  {gigs.length} gig{gigs.length === 1 ? '' : 's'}
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

              {isOwnProfile && !profile.avatarUrl ? (
                <Button
                  title="Add avatar"
                  onPress={() => setEditOpen(true)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Camera size={14} color={theme[950]} />}
                  className="mt-3"
                />
              ) : null}
            </View>

            <View style={{ gap: 12 }}>
              <SectionLabel label="Creator" />
              <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 10 }}>
                {profile.creatorProfile ? (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {profile.creatorProfile.niches.map((niche) => (
                        <Pill key={niche} intent="cyan" label={niche} />
                      ))}
                    </View>
                    {profile.creatorProfile.portfolioUrl ? (
                      <Pressable onPress={() => Linking.openURL(profile.creatorProfile!.portfolioUrl!)}>
                        <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
                          Portfolio
                        </ThemedText>
                      </Pressable>
                    ) : null}
                    {profile.creatorProfile.socialLinks.length > 0 ? (
                      <View style={{ gap: 6 }}>
                        {profile.creatorProfile.socialLinks.map((link) => (
                          <Pressable
                            key={`${link.platform}:${link.handle}`}
                            onPress={() => Linking.openURL(socialLinkUrl(link))}
                          >
                            <ThemedText type="body-sm" style={{ color: theme[700] }}>
                              {PLATFORM_LABEL[link.platform]} @{link.handle}
                            </ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : (
                  <ThemedText type="body-sm" style={{ color: theme[500] }}>
                    Creator profile is not set up.
                  </ThemedText>
                )}
              </View>
            </View>

            <View style={{ gap: 12 }}>
              <SectionLabel label="Brand" />
              <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                {profile.brandProfile ? (
                  <>
                    <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                      {profile.brandProfile.companyName}
                    </ThemedText>
                    {profile.brandProfile.industry ? (
                      <Pill intent="orange" label={profile.brandProfile.industry} />
                    ) : null}
                    {profile.brandProfile.websiteUrl ? (
                      <Pressable onPress={() => Linking.openURL(profile.brandProfile!.websiteUrl!)}>
                        <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
                          Website
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </>
                ) : (
                  <ThemedText type="body-sm" style={{ color: theme[500] }}>
                    Brand profile is not set up.
                  </ThemedText>
                )}
              </View>
            </View>

            <View style={{ gap: 12 }}>
              <SectionLabel label="Reputation" />
              <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 4 }}>
                {reviewsQuery.isLoading ? (
                  <ActivityIndicator color={theme[500]} />
                ) : reputation.count > 0 ? (
                  <>
                    <ThemedText type="body-2xl-semibold" style={{ color: theme[950] }}>
                      {reputation.overall.toFixed(1)} / 5
                    </ThemedText>
                    <ThemedText type="body-sm" style={{ color: theme[500] }}>
                      {reputation.count} review{reputation.count === 1 ? '' : 's'} · {formatSol(reputation.totalSol)} SOL reviewed
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                      Reputation pending
                    </ThemedText>
                    <ThemedText type="body-sm" style={{ color: theme[500] }}>
                      Reviews appear here after completed orders.
                    </ThemedText>
                  </>
                )}
              </View>
            </View>

            <View style={{ gap: 12 }}>
              <SectionLabel label="Services" />
              {servicesQuery.isLoading ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={theme[500]} />
                </View>
              ) : services.length === 0 ? (
                <EmptyState title={EMPTY_PACKAGES_BY_SELLER.title} description={EMPTY_PACKAGES_BY_SELLER.description} />
              ) : (
                <View style={{ gap: 14 }}>{services.map((item) => renderListing(item as Service))}</View>
              )}
            </View>

            <View style={{ gap: 12 }}>
              <SectionLabel label="Gigs" />
              {gigsQuery.isLoading ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={theme[500]} />
                </View>
              ) : gigs.length === 0 ? (
                <EmptyState title={EMPTY_GIGS_BY_BRAND.title} description={EMPTY_GIGS_BY_BRAND.description} />
              ) : (
                <View style={{ gap: 14 }}>{gigs.map((item) => renderListing(item as Gig))}</View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
      <EditProfileSheet visible={editOpen} onClose={() => setEditOpen(false)} />
    </ThemedView>
  );
}

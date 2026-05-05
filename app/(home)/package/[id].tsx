import React, { useMemo, useState } from 'react';
import { View, ScrollView, ActivityIndicator, FlatList, Image, Pressable, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { KPI } from '@/components/ui/KPI';
import { Pill, type PillIntent } from '@/components/ui/Pill';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { ManageListingSheet } from '@/components/features/listing/ManageListingSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getPackage } from '@/lib/services/packageService';
import { getProfile } from '@/lib/services/profileService';
import { PACKAGE_KEYS, PROFILE_KEYS } from '@/lib/constants/queryKeys';
import { formatSol } from '@/lib/utils/formatNumber';
import type { PackageStatus } from '@/types/marketplace';

function statusToIntent(status: PackageStatus): PillIntent {
  if (status === 'active') return 'cyan';
  if (status === 'sold') return 'lime';
  return 'neutral';
}

const GALLERY_HEIGHT = 280;

export default function PackageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [manageOpen, setManageOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const packageQuery = useQuery({
    queryKey: id ? PACKAGE_KEYS.detail(id) : ['package', 'unknown'],
    enabled: !!id,
    queryFn: () => getPackage(id!),
  });

  const sellerQuery = useQuery({
    queryKey: packageQuery.data ? PROFILE_KEYS.profile(packageQuery.data.sellerId) : ['profile', 'unknown'],
    enabled: !!packageQuery.data?.sellerId,
    queryFn: () => getProfile(packageQuery.data!.sellerId),
  });

  const pkg = packageQuery.data;
  const isOwnPackage = !!user && pkg?.sellerId === user.id;
  const sellerHasWallet = !!sellerQuery.data?.walletAddress;
  const canBuy = !isOwnPackage && pkg?.status === 'active' && sellerHasWallet;

  // Gallery slides: cover first (if set), then mediaUrls — de-duped so a cover
  // that also lives in mediaUrls doesn't render twice.
  const slides = useMemo(() => {
    if (!pkg) return [] as string[];
    const ordered = [pkg.coverImageUrl, ...pkg.mediaUrls].filter(
      (url): url is string => typeof url === 'string' && url.length > 0,
    );
    return Array.from(new Set(ordered));
  }, [pkg]);

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (next !== galleryIndex) setGalleryIndex(next);
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader
          title="Package"
          onBack={() => router.back()}
          actionButton={
            isOwnPackage && pkg
              ? {
                  icon: MoreHorizontal,
                  onPress: () => setManageOpen(true),
                  accessibilityLabel: 'Manage package',
                }
              : undefined
          }
        />

        {packageQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : !pkg ? (
          <View className="flex-1 items-center justify-center px-4">
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              Package not found.
            </ThemedText>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{
                paddingTop: slides.length > 0 ? 0 : 8,
                paddingBottom: canBuy ? 134 : 32,
                gap: 16,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Gallery (full-bleed, page-snapping) — cover first, then media. */}
              {slides.length > 0 ? (
                <View style={{ gap: 10 }}>
                  <FlatList
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    data={slides}
                    keyExtractor={(uri, i) => `${uri}-${i}`}
                    renderItem={({ item }) => (
                      <Image
                        source={{ uri: item }}
                        style={{ width: screenWidth, height: GALLERY_HEIGHT }}
                        resizeMode="cover"
                      />
                    )}
                    onMomentumScrollEnd={onGalleryScroll}
                  />
                  {slides.length > 1 ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      {slides.map((_, i) => (
                        <View
                          key={i}
                          style={{
                            width: i === galleryIndex ? 18 : 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: i === galleryIndex ? theme[950] : theme[300],
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={{ paddingHorizontal: 16, gap: 16 }}>
              {/* KPI block */}
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                  }}
                >
                  <KPI size="md" amount={formatSol(pkg.priceSol)} unit="SOL" />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pill intent={statusToIntent(pkg.status)} label={pkg.status} />
                    <Pill intent="pink" label="Package" />
                  </View>
                </View>
                <ThemedText type="h4" style={{ color: theme[950] }} numberOfLines={3}>
                  {pkg.title}
                </ThemedText>
              </View>

              {/* About */}
              <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                <SectionLabel label="About" />
                <ThemedText type="body-md" style={{ color: theme[950] }}>
                  {pkg.description}
                </ThemedText>
              </View>

              {/* Deliverables */}
              {pkg.deliverables.length > 0 && (
                <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                  <SectionLabel label="Deliverables" />
                  <View style={{ gap: 6 }}>
                    {pkg.deliverables.map((d, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                        <ThemedText type="body-md" style={{ color: theme[500] }}>
                          ·
                        </ThemedText>
                        <ThemedText type="body-md" style={{ color: theme[950], flex: 1 }}>
                          {d}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Seller — tap to open public profile */}
              <Pressable
                onPress={() => {
                  if (!pkg.sellerId) return;
                  router.push(`/profile/${pkg.sellerId}`);
                }}
                style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 4 }}
              >
                <SectionLabel label="Seller" />
                <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                  {sellerQuery.data?.displayName ?? '—'}
                </ThemedText>
                <ThemedText type="body-sm" style={{ color: theme[500] }}>
                  @{sellerQuery.data?.username ?? '—'}
                </ThemedText>
              </Pressable>

              {isOwnPackage && (
                <ThemedText
                  type="body-sm"
                  align="center"
                  style={{ color: theme[500], marginTop: 8 }}
                >
                  You are the seller of this package.
                </ThemedText>
              )}
              {!isOwnPackage && pkg.status === 'active' && !sellerHasWallet && (
                <ThemedText
                  type="body-sm"
                  align="center"
                  style={{ color: theme[500], marginTop: 8 }}
                >
                  This seller hasn&apos;t set up a wallet yet, so payment is unavailable.
                </ThemedText>
              )}
              </View>
            </ScrollView>

            {canBuy && (
              <CtaFooter>
                <Button
                  title={`Buy for ${formatSol(pkg.priceSol)} SOL`}
                  onPress={() =>
                    router.push({
                      pathname: '/checkout',
                      params: {
                        type: 'package',
                        referenceId: pkg.id,
                        sellerId: pkg.sellerId,
                        amountSol: String(pkg.priceSol),
                        title: pkg.title,
                      },
                    })
                  }
                  variant="primary"
                  size="lg"
                  className="w-full"
                />
              </CtaFooter>
            )}
          </>
        )}
      </SafeAreaView>

      {pkg && isOwnPackage ? (
        <ManageListingSheet
          visible={manageOpen}
          onClose={() => setManageOpen(false)}
          kind="package"
          id={pkg.id}
          status={pkg.status}
          ownerId={pkg.sellerId}
        />
      ) : null}
    </ThemedView>
  );
}

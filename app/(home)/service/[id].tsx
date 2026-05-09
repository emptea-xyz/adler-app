import React, { useMemo, useState } from 'react';
import { View, ScrollView, ActivityIndicator, FlatList, Image, Pressable, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
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
import { getListing } from '@/lib/services/listingsService';
import { getProfile } from '@/lib/services/profileService';
import { qk } from '@/lib/constants/queryKeys';
import { formatSol } from '@/lib/utils/formatNumber';
import type { Service, ServiceStatus } from '@/types/marketplace';

function statusToIntent(status: ServiceStatus): PillIntent {
  if (status === 'active') return 'cyan';
  if (status === 'sold') return 'lime';
  return 'neutral';
}

const GALLERY_HEIGHT = 280;

function isVideoUrl(url: string): boolean {
  const value = url.toLowerCase();
  return value.includes('.mp4') || value.includes('.mov') || value.includes('.webm');
}

function ServiceVideoSlide({
  uri,
  width,
  overlay,
}: {
  uri: string;
  width: number;
  overlay: Service['overlay'] | null | undefined;
}) {
  const { theme } = useTheme();
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.play();
  });
  const x = Math.min(0.92, Math.max(0.08, overlay?.x ?? 0.5));
  const y = Math.min(0.92, Math.max(0.08, overlay?.y ?? 0.5));

  return (
    <View
      style={{
        width,
        height: GALLERY_HEIGHT,
        backgroundColor: theme[950],
      }}
    >
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="cover"
        style={{ width: '100%', height: '100%' }}
      />
      {overlay?.text ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            transform: [{ translateX: -120 }, { translateY: -18 }, { scale: overlay.scale ?? 1 }],
            width: 240,
            alignItems: 'center',
          }}
        >
          <ThemedText
            type="body-lg-semibold"
            style={{
              color: overlay.color || theme[50],
              textAlign: 'center',
            }}
          >
            {overlay.text}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [manageOpen, setManageOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const serviceQuery = useQuery({
    queryKey: id ? qk.listings.detail('service', id) : ['listings', 'detail', 'service', 'unknown'],
    enabled: !!id,
    queryFn: () => getListing('service', id!),
  });

  const service = serviceQuery.data && serviceQuery.data.kind === 'service' ? (serviceQuery.data as Service) : null;

  const sellerQuery = useQuery({
    queryKey: service ? qk.profiles.detail(service.sellerId) : ['profiles', 'detail', 'unknown'],
    enabled: !!service?.sellerId,
    queryFn: () => getProfile(service!.sellerId),
  });

  const isOwnService = !!user && service?.sellerId === user.id;
  const showBuyCta = !!service && !isOwnService && service.status === 'active';

  const slides = useMemo(() => {
    if (!service) return [] as string[];
    const ordered = service.mediaUrls.filter(
      (url): url is string => typeof url === 'string' && url.length > 0,
    );
    return Array.from(new Set(ordered));
  }, [service]);

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (next !== galleryIndex) setGalleryIndex(next);
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader
          title="Service"
          onBack={() => router.back()}
          actionButton={
            isOwnService && service
              ? {
                  icon: MoreHorizontal,
                  onPress: () => setManageOpen(true),
                  accessibilityLabel: 'Manage service',
                }
              : undefined
          }
        />

        {serviceQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme[950]} />
          </View>
        ) : !service ? (
          <View className="flex-1 items-center justify-center px-4">
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              Service not found.
            </ThemedText>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{
                paddingTop: slides.length > 0 ? 0 : 8,
                paddingBottom: showBuyCta ? 134 : 32,
                gap: 16,
              }}
              showsVerticalScrollIndicator={false}
            >
              {slides.length > 0 ? (
                <View style={{ gap: 10 }}>
                  <FlatList
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    data={slides}
                    keyExtractor={(uri, i) => `${uri}-${i}`}
                    renderItem={({ item }) => (
                      isVideoUrl(item) ? (
                        <ServiceVideoSlide
                          uri={item}
                          width={screenWidth}
                          overlay={service.overlay}
                        />
                      ) : (
                        <Image
                          source={{ uri: item }}
                          style={{ width: screenWidth, height: GALLERY_HEIGHT }}
                          resizeMode="cover"
                        />
                      )
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
                <View style={{ gap: 12 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                    }}
                  >
                    <KPI size="md" amount={formatSol(service.priceSol)} unit="SOL" />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pill intent={statusToIntent(service.status)} label={service.status} />
                      <Pill intent="pink" label="Service" />
                    </View>
                  </View>
                  <ThemedText type="h4" style={{ color: theme[950] }} numberOfLines={3}>
                    {service.title}
                  </ThemedText>
                </View>

                <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
                  <SectionLabel label="About" />
                  <ThemedText type="body-md" style={{ color: theme[950] }}>
                    {service.description}
                  </ThemedText>
                </View>

                <Pressable
                  onPress={() => {
                    if (!service.sellerId) return;
                    router.push(`/profile/${service.sellerId}`);
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

                {isOwnService && (
                  <ThemedText
                    type="body-sm"
                    align="center"
                    style={{ color: theme[500], marginTop: 8 }}
                  >
                    You are the seller of this service.
                  </ThemedText>
                )}
              </View>
            </ScrollView>

            {showBuyCta && (
              <CtaFooter helperText="Funds are held in escrow until delivery approval.">
                <Button
                  title={`Buy for ${formatSol(service.priceSol)} SOL`}
                  onPress={() => {
                    router.push({
                      pathname: '/checkout',
                      params: {
                        type: 'service',
                        listingId: service.id,
                        sellerId: service.sellerId,
                        amountSol: String(service.priceSol),
                        title: service.title,
                      },
                    });
                  }}
                  variant="primary"
                  size="lg"
                  className="w-full"
                />
              </CtaFooter>
            )}
          </>
        )}
      </SafeAreaView>

      {service && isOwnService ? (
        <ManageListingSheet
          visible={manageOpen}
          onClose={() => setManageOpen(false)}
          kind="service"
          id={service.id}
          status={service.status}
          ownerId={service.sellerId}
        />
      ) : null}
    </ThemedView>
  );
}

import React from 'react';
import { View, ScrollView, ActivityIndicator, FlatList, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { KPI } from '@/components/ui/KPI';
import { Pill, type PillIntent } from '@/components/ui/Pill';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getPackage } from '@/lib/services/packageService';
import { getProfile } from '@/lib/services/profileService';
import { PACKAGE_KEYS, PROFILE_KEYS } from '@/lib/constants/queryKeys';
import type { PackageStatus } from '@/types/marketplace';

function statusToIntent(status: PackageStatus): PillIntent {
  if (status === 'active') return 'cyan';
  if (status === 'sold') return 'lime';
  return 'neutral';
}

function ucfirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const GALLERY_HEIGHT = 280;

export default function PackageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

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
  const canBuy = !isOwnPackage && pkg?.status === 'active';

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader title="Package" onBack={() => router.back()} />

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
                paddingTop: pkg.mediaUrls.length > 0 ? 0 : 8,
                paddingBottom: canBuy ? 134 : 32,
                gap: 16,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Gallery (full-bleed, page-snapping) */}
              {pkg.mediaUrls.length > 0 ? (
                <FlatList
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  data={pkg.mediaUrls}
                  keyExtractor={(uri, i) => `${uri}-${i}`}
                  renderItem={({ item }) => (
                    <Image
                      source={{ uri: item }}
                      style={{ width: screenWidth, height: GALLERY_HEIGHT }}
                      resizeMode="cover"
                    />
                  )}
                />
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
                  <KPI size="md" amount={pkg.priceSol} unit="SOL" />
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

              {/* Seller */}
              <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 4 }}>
                <SectionLabel label="Seller" />
                <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                  {sellerQuery.data?.displayName ?? '—'}
                </ThemedText>
                <ThemedText type="body-sm" style={{ color: theme[500] }}>
                  @{sellerQuery.data?.username ?? '—'}
                </ThemedText>
              </View>

              {isOwnPackage && (
                <ThemedText
                  type="body-sm"
                  align="center"
                  style={{ color: theme[500], marginTop: 8 }}
                >
                  You are the seller of this package.
                </ThemedText>
              )}
              </View>
            </ScrollView>

            {canBuy && (
              <CtaFooter>
                <Button
                  title={`Buy for ${pkg.priceSol} SOL`}
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
    </ThemedView>
  );
}

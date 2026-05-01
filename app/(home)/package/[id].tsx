import React from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getPackage } from '@/lib/services/packageService';
import { getProfile } from '@/lib/services/profileService';
import { PACKAGE_KEYS, PROFILE_KEYS } from '@/lib/constants/queryKeys';

export default function PackageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
          <View className="flex-1 items-center justify-center px-6">
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              Package not found.
            </ThemedText>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 8,
                paddingBottom: canBuy ? 120 : 32,
                gap: 16,
              }}
            >
              {/* Top-left KPI: amount + unit, then kind label, then title.
                  Eye lands on price first — the most decision-relevant data. */}
              <View>
                <View className="flex-row items-baseline gap-2">
                  <ThemedText type="h2" className="tracking-tight">
                    {pkg.priceSol}
                  </ThemedText>
                  <ThemedText type="body-md-semibold" style={{ color: theme[500] }}>
                    SOL
                  </ThemedText>
                  <View className="flex-1" />
                  <ThemedText
                    type="caption-semibold"
                    style={{ color: theme[700], letterSpacing: 0.6 }}
                  >
                    PACKAGE · {pkg.status.toUpperCase()}
                  </ThemedText>
                </View>
                <ThemedText type="h4" className="mt-3">
                  {pkg.title}
                </ThemedText>
              </View>

              <Card>
                <ThemedText type="caption-semibold" style={{ color: theme[500], letterSpacing: 0.6 }}>
                  ABOUT
                </ThemedText>
                <ThemedText type="body-md" className="mt-2">
                  {pkg.description}
                </ThemedText>
              </Card>

              {pkg.deliverables.length > 0 && (
                <Card>
                  <ThemedText type="caption-semibold" style={{ color: theme[500], letterSpacing: 0.6 }}>
                    DELIVERABLES
                  </ThemedText>
                  <View className="mt-2 gap-1.5">
                    {pkg.deliverables.map((d, i) => (
                      <View key={i} className="flex-row gap-2">
                        <ThemedText type="body-md" style={{ color: theme[500] }}>
                          ·
                        </ThemedText>
                        <ThemedText type="body-md" className="flex-1">
                          {d}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </Card>
              )}

              <Card>
                <ThemedText type="caption-semibold" style={{ color: theme[500], letterSpacing: 0.6 }}>
                  SELLER
                </ThemedText>
                <ThemedText type="body-md-semibold" className="mt-2">
                  {sellerQuery.data?.displayName ?? '—'}
                </ThemedText>
                <ThemedText type="body-sm" style={{ color: theme[500] }}>
                  @{sellerQuery.data?.username ?? '—'}
                </ThemedText>
              </Card>

              {isOwnPackage && (
                <ThemedText
                  type="body-sm"
                  align="center"
                  style={{ color: theme[500] }}
                  className="mt-2"
                >
                  You are the seller of this package.
                </ThemedText>
              )}
            </ScrollView>

            {canBuy && (
              <View
                className="px-6"
                style={{
                  paddingTop: 12,
                  paddingBottom: insets.bottom + 12,
                  backgroundColor: theme[50],
                  borderTopWidth: 1,
                  borderTopColor: theme[200],
                }}
              >
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
                />
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

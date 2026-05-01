import React from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
          <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
            <View>
              <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                {pkg.priceSol} SOL
              </ThemedText>
              <ThemedText type="h3" className="mt-1">
                {pkg.title}
              </ThemedText>
            </View>

            <Card>
              <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                ABOUT
              </ThemedText>
              <ThemedText type="body-md" className="mt-2">
                {pkg.description}
              </ThemedText>
            </Card>

            <Card>
              <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                SELLER
              </ThemedText>
              <ThemedText type="body-md-semibold" className="mt-1">
                {sellerQuery.data?.displayName ?? '—'}
              </ThemedText>
              <ThemedText type="body-sm" style={{ color: theme[500] }}>
                @{sellerQuery.data?.username ?? '—'}
              </ThemedText>
            </Card>

            {!isOwnPackage && pkg.status === 'active' && (
              <Button
                title={`Buy for ${pkg.priceSol} SOL`}
                onPress={() => router.push({
                  pathname: '/checkout',
                  params: {
                    type: 'package',
                    referenceId: pkg.id,
                    sellerId: pkg.sellerId,
                    amountSol: String(pkg.priceSol),
                    title: pkg.title,
                  },
                })}
                variant="primary"
                size="lg"
              />
            )}

            {isOwnPackage && (
              <ThemedText type="body-sm" style={{ color: theme[500] }} align="center">
                You are the seller of this package.
              </ThemedText>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

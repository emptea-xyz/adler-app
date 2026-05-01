import React from 'react';
import { View, ScrollView, Pressable, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Settings, Wallet, Copy, ExternalLink } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import Card from '@/components/ui/Card';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getConnection, lamportsToSol, explorerAddressUrl } from '@/lib/solana/connection';
import { PROFILE_KEYS } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';

function shortenAddress(address: string | null): string {
  if (!address) return '—';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function ProfileScreen() {
  const { profile } = useUser();
  const { walletAddress } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const balanceQuery = useQuery({
    queryKey: walletAddress ? PROFILE_KEYS.walletBalance(walletAddress) : ['wallet', 'balance', 'none'],
    enabled: !!walletAddress,
    queryFn: async () => {
      if (!walletAddress) return 0;
      const lamports = await getConnection().getBalance(new PublicKey(walletAddress));
      return lamportsToSol(lamports);
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const copyAddress = async () => {
    if (!walletAddress) return;
    haptic('light');
    await Clipboard.setStringAsync(walletAddress);
    toast.success('Wallet address copied');
  };

  const openExplorer = () => {
    if (!walletAddress) return;
    haptic('light');
    Linking.openURL(explorerAddressUrl(walletAddress));
  };

  const initial = profile?.displayName?.charAt(0)?.toUpperCase() ?? '·';

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: TAB_BAR_HEIGHT + 32,
            gap: 16,
          }}
        >
          <View className="flex-row items-center justify-between mb-1">
            <ThemedText type="h3">Profile</ThemedText>
            <Pressable
              onPress={() => {
                haptic('light');
                router.push('/settings');
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Settings color={theme[500]} size={22} />
            </Pressable>
          </View>

          {/* Identity card: avatar initial + display name + username + role */}
          <Card>
            <View className="flex-row items-center gap-4">
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{ backgroundColor: theme[100] }}
              >
                <ThemedText type="h4" style={{ color: theme[700] }}>
                  {initial}
                </ThemedText>
              </View>
              <View className="flex-1">
                <ThemedText type="body-lg-semibold" numberOfLines={1}>
                  {profile?.displayName ?? '—'}
                </ThemedText>
                <ThemedText type="body-sm" style={{ color: theme[500] }} numberOfLines={1}>
                  @{profile?.username ?? '—'}
                </ThemedText>
              </View>
              <View
                className="px-2.5 py-1 rounded-full"
                style={{ backgroundColor: theme[950] }}
              >
                <ThemedText
                  type="caption-semibold"
                  style={{ color: theme[50], letterSpacing: 0.6 }}
                >
                  {profile?.role?.toUpperCase() ?? 'NO ROLE'}
                </ThemedText>
              </View>
            </View>
            {!!profile?.bio && (
              <ThemedText type="body-sm" className="mt-3" style={{ color: theme[700] }}>
                {profile.bio}
              </ThemedText>
            )}
          </Card>

          {/* Wallet card. Balance is the primary KPI; address + actions below. */}
          <Card>
            <View className="flex-row items-center gap-2 mb-3">
              <Wallet color={theme[500]} size={14} />
              <ThemedText type="caption-semibold" style={{ color: theme[500], letterSpacing: 0.6 }}>
                SOLANA WALLET (DEVNET)
              </ThemedText>
            </View>
            <View className="flex-row items-baseline gap-2">
              {balanceQuery.isLoading ? (
                <ActivityIndicator size="small" color={theme[500]} />
              ) : (
                <>
                  <ThemedText type="h3" className="tracking-tight">
                    {balanceQuery.data !== undefined ? balanceQuery.data.toFixed(3) : '—'}
                  </ThemedText>
                  <ThemedText type="body-md-semibold" style={{ color: theme[500] }}>
                    SOL
                  </ThemedText>
                </>
              )}
            </View>
            <ThemedText type="body-sm" className="mt-2 font-mono" style={{ color: theme[700] }}>
              {shortenAddress(walletAddress)}
            </ThemedText>

            <View className="flex-row gap-4 mt-4">
              <Pressable onPress={copyAddress} className="flex-row items-center gap-1.5" hitSlop={8}>
                <Copy color={theme[700]} size={14} />
                <ThemedText type="body-sm-semibold">Copy</ThemedText>
              </Pressable>
              <Pressable onPress={openExplorer} className="flex-row items-center gap-1.5" hitSlop={8}>
                <ExternalLink color={theme[700]} size={14} />
                <ThemedText type="body-sm-semibold">Explorer</ThemedText>
              </Pressable>
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

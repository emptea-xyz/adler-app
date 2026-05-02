import React from 'react';
import { View, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Settings as Cog, Wallet, Copy, ExternalLink } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Avatar } from '@/components/ui/Avatar';
import { KPI } from '@/components/ui/KPI';
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

function ucfirst(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
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
          {/* Title row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 4,
            }}
          >
            <ThemedText type="h3" style={{ color: theme[950] }}>
              Profile
            </ThemedText>
            <Pressable
              onPress={() => {
                haptic('light');
                router.push('/settings');
              }}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Cog size={24} color={theme[950]} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Identity card */}
          <View
            style={{
              backgroundColor: theme[100],
              padding: 20,
              borderRadius: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Avatar
                avatarUrl={profile?.avatarUrl}
                size="lg"
                initial={profile?.displayName?.[0]}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="body-lg-semibold" style={{ color: theme[950] }} numberOfLines={1}>
                  {profile?.displayName ?? '—'}
                </ThemedText>
                <ThemedText type="body-sm" style={{ color: theme[500] }} numberOfLines={1}>
                  @{profile?.username ?? '—'}
                </ThemedText>
              </View>
              <View
                style={{
                  backgroundColor: theme[950],
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 9999,
                }}
              >
                <ThemedText type="caption-semibold" style={{ color: theme[50] }}>
                  {ucfirst(profile?.role) || 'No role'}
                </ThemedText>
              </View>
            </View>
            {profile?.bio ? (
              <ThemedText type="body-sm" style={{ color: theme[700], marginTop: 12 }}>
                {profile.bio}
              </ThemedText>
            ) : null}
          </View>

          {/* Wallet card */}
          <View
            style={{
              backgroundColor: theme[100],
              padding: 20,
              borderRadius: 12,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Wallet color={theme[500]} size={14} />
              <SectionLabel label="Solana wallet (devnet)" />
            </View>
            <KPI
              size="md"
              amount={balanceQuery.data !== undefined ? balanceQuery.data.toFixed(3) : '—'}
              unit="SOL"
            />
            <ThemedText type="body-sm" style={{ color: theme[700] }}>
              {shortenAddress(walletAddress)}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 16, paddingTop: 8 }}>
              <Pressable
                onPress={copyAddress}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                hitSlop={8}
              >
                <Copy color={theme[950]} size={14} />
                <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
                  Copy
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={openExplorer}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                hitSlop={8}
              >
                <ExternalLink color={theme[950]} size={14} />
                <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
                  Explorer
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

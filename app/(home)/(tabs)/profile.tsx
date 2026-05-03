import React, { useState } from 'react';
import { View, ScrollView, Pressable, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Settings as Cog,
  Wallet,
  Copy,
  ExternalLink,
  RefreshCw,
  QrCode,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Avatar } from '@/components/ui/Avatar';
import { KPI } from '@/components/ui/KPI';
import { Button } from '@/components/ui/Button';
import { ListingCard } from '@/components/ui/ListingCard';
import EmptyState from '@/components/ui/EmptyState';
import { ReceiveSheet } from '@/components/features/wallet/ReceiveSheet';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { getConnection, lamportsToSol, explorerAddressUrl } from '@/lib/solana/connection';
import { listPackagesBySeller } from '@/lib/services/packageService';
import { listGigsByBrand } from '@/lib/services/gigService';
import { PROFILE_KEYS, PACKAGE_KEYS, GIG_KEYS } from '@/lib/constants/queryKeys';
import { SOLANA_NETWORK } from '@/lib/constants/featureGates';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import {
  EMPTY_PACKAGES_BY_SELLER,
  EMPTY_GIGS_BY_BRAND,
} from '@/lib/utils/copy';

function shortenAddress(address: string | null): string {
  if (!address) return '—';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function ucfirst(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const LISTINGS_PREVIEW_LIMIT = 5;

export default function ProfileScreen() {
  const { profile } = useUser();
  const { walletAddress } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openRoleSwitch, openCreate: openCreateFromProfile } = useOverlaySheets();
  const [receiveOpen, setReceiveOpen] = useState(false);

  const isCreator = profile?.role === 'creator';

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

  const refreshBalance = () => {
    if (!walletAddress) return;
    haptic('light');
    queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.walletBalance(walletAddress) });
  };

  const listings = isCreator ? packagesQuery.data ?? [] : gigsQuery.data ?? [];
  const listingsLoading = isCreator ? packagesQuery.isLoading : gigsQuery.isLoading;
  const listingsTitle = isCreator ? 'Your packages' : 'Your gigs';
  const listingsEmpty = isCreator ? EMPTY_PACKAGES_BY_SELLER : EMPTY_GIGS_BY_BRAND;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
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
          <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12 }}>
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
              <Pressable
                onPress={() => {
                  haptic('light');
                  openRoleSwitch();
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Switch role"
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
              </Pressable>
            </View>
            {profile?.bio ? (
              <ThemedText type="body-sm" style={{ color: theme[700], marginTop: 12 }}>
                {profile.bio}
              </ThemedText>
            ) : null}
          </View>

          {/* Wallet card — full wallet interface inline */}
          <View style={{ backgroundColor: theme[100], padding: 20, borderRadius: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Wallet color={theme[500]} size={14} />
              <SectionLabel label={`Solana wallet (${SOLANA_NETWORK})`} />
            </View>
            <KPI
              size="md"
              amount={balanceQuery.data !== undefined ? balanceQuery.data.toFixed(3) : '—'}
              unit="SOL"
            />
            <ThemedText type="body-sm" style={{ color: theme[700] }}>
              {shortenAddress(walletAddress)}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 16, paddingTop: 8, flexWrap: 'wrap' }}>
              <Pressable
                onPress={() => {
                  haptic('light');
                  setReceiveOpen(true);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                hitSlop={8}
              >
                <QrCode color={theme[950]} size={14} />
                <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
                  Receive
                </ThemedText>
              </Pressable>
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
              <Pressable
                onPress={refreshBalance}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                hitSlop={8}
                disabled={balanceQuery.isFetching}
              >
                {balanceQuery.isFetching ? (
                  <ActivityIndicator size="small" color={theme[950]} />
                ) : (
                  <RefreshCw color={theme[950]} size={14} />
                )}
                <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
                  Refresh
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Platform integration — your listings */}
          <View style={{ gap: 12, marginTop: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <SectionLabel label={listingsTitle} />
              {listings.length > 0 ? (
                <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                  {listings.length}
                </ThemedText>
              ) : null}
            </View>

            {listingsLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={theme[500]} />
              </View>
            ) : listings.length === 0 ? (
              <View style={{ gap: 12, paddingTop: 8 }}>
                <EmptyState
                  title={listingsEmpty.title}
                  description={listingsEmpty.description}
                />
                <Button
                  title={isCreator ? 'List a package' : 'Post a gig'}
                  onPress={() => {
                    haptic('light');
                    openCreateFromProfile();
                  }}
                  variant="secondary"
                  className="self-center"
                />
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                {listings.slice(0, LISTINGS_PREVIEW_LIMIT).map((item) => {
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
                      ownerId={profile?.id ?? ''}
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
      </SafeAreaView>

      <ReceiveSheet
        visible={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        walletAddress={walletAddress}
      />
    </ThemedView>
  );
}

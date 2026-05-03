import React from 'react';
import { View, Pressable } from 'react-native';
import { Settings as Cog, Pencil } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { ThemedText } from '@/components/base/ThemedText';
import { Avatar } from '@/components/ui/Avatar';
import { WalletPill } from '@/components/ui/WalletPill';
import { Pill } from '@/components/ui/Pill';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { getConnection, lamportsToSol } from '@/lib/solana/connection';
import { PROFILE_KEYS } from '@/lib/constants/queryKeys';
import { haptic } from '@/lib/utils/haptic';

interface Props {
  listingsCount: number;
  onPressEdit: () => void;
}

const AVATAR_PX = 88;

function formatJoinedDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function ucfirst(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ProfileHeader({ listingsCount, onPressEdit }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const { profile } = useUser();
  const { walletAddress } = useAuth();
  const { openWallet } = useOverlaySheets();

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

  const balanceText =
    balanceQuery.data === undefined
      ? '—'
      : balanceQuery.data >= 100
        ? balanceQuery.data.toFixed(0)
        : balanceQuery.data.toFixed(3);

  const joined = profile?.createdAt ? formatJoinedDate(profile.createdAt) : null;

  return (
    <View style={{ paddingTop: 16, paddingBottom: 8 }}>
      {/* Top corners: cog left, wallet pill right. Centered content sits below. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 44,
          paddingHorizontal: 0,
        }}
      >
        <Pressable
          onPress={() => {
            haptic('light');
            router.push('/settings');
          }}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={6}
        >
          <Cog size={22} color={theme[950]} strokeWidth={2} />
        </Pressable>
        <WalletPill
          amount={balanceText}
          loading={balanceQuery.isLoading}
          onPress={openWallet}
        />
      </View>

      {/* Avatar + identity, centered, TikTok-style. */}
      <View style={{ alignItems: 'center', gap: 8, marginTop: 12 }}>
        <View style={{ width: AVATAR_PX, height: AVATAR_PX, borderRadius: AVATAR_PX / 2, overflow: 'hidden' }}>
          <Avatar
            avatarUrl={profile?.avatarUrl}
            size="lg"
            initial={profile?.displayName?.[0]}
          />
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <ThemedText
            type="body-2xl-semibold"
            style={{ color: theme[950] }}
            numberOfLines={1}
          >
            {profile?.displayName ?? '—'}
          </ThemedText>
          <ThemedText type="body-sm" style={{ color: theme[500] }} numberOfLines={1}>
            @{profile?.username ?? '—'}
          </ThemedText>
        </View>

        {profile?.role ? (
          <View style={{ marginTop: 2 }}>
            <Pill intent="dark" label={ucfirst(profile.role)} />
          </View>
        ) : null}

        {profile?.bio ? (
          <ThemedText
            type="body-sm"
            align="center"
            style={{ color: theme[700], marginTop: 4, paddingHorizontal: 8 }}
          >
            {profile.bio}
          </ThemedText>
        ) : null}

        {/* Stats line — small, muted */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <ThemedText type="body-xs" style={{ color: theme[500] }}>
            {listingsCount} listing{listingsCount === 1 ? '' : 's'}
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

        {/* Edit affordance */}
        <Pressable
          onPress={() => {
            haptic('light');
            onPressEdit();
          }}
          hitSlop={8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 9999,
            backgroundColor: theme[100],
          }}
        >
          <Pencil size={12} color={theme[950]} strokeWidth={2} />
          <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
            Edit profile
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

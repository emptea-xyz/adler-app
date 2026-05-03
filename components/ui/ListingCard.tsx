import React from 'react';
import { Pressable, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { formatRelative } from '@/lib/utils/dates';
import { getProfile } from '@/lib/services/profileService';
import { PROFILE_KEYS } from '@/lib/constants/queryKeys';
import { KPI } from './KPI';
import { Pill, type PillIntent } from './Pill';

// Figma node 127:124 — feed card on Browse. Peach gradient hero + KPI + status
// pills + title + meta.

interface ListingCardProps {
  kind: 'package' | 'gig';
  amount: number;
  category: string;
  title: string;
  ownerId: string;       // sellerId or brandId — used to fetch the @username
  createdAt: number;
  /** Optional cover image. First entry is rendered as the 130px hero;
   *  if absent we fall back to the peach gradient placeholder. */
  mediaUrls?: string[];
  onPress: () => void;
}

const CATEGORY_INTENT: Record<string, PillIntent> = {
  beauty: 'pink',
  skincare: 'pink',
  fitness: 'cyan',
  health: 'cyan',
  education: 'orange',
  food: 'lime',
  lifestyle: 'lime',
};

function categoryToIntent(category: string): PillIntent {
  return CATEGORY_INTENT[category.toLowerCase()] ?? 'neutral';
}

export function ListingCard({
  kind,
  amount,
  category,
  title,
  ownerId,
  createdAt,
  mediaUrls,
  onPress,
}: ListingCardProps) {
  const { theme } = useTheme();

  const profileQuery = useQuery({
    queryKey: PROFILE_KEYS.profile(ownerId),
    queryFn: () => getProfile(ownerId),
    staleTime: 60_000,
  });

  const username = profileQuery.data?.username ?? '—';
  const heroUri = mediaUrls?.[0];

  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={{
        backgroundColor: theme[100],
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {heroUri ? (
        <Image
          source={{ uri: heroUri }}
          style={{ height: 130, width: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#ffd6a8', '#ffccd4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ height: 130 }}
        />
      )}
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <KPI size="md" amount={amount} unit="SOL" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pill intent={categoryToIntent(category)} label={category} />
            <Pill
              intent={kind === 'package' ? 'pink' : 'dark'}
              label={kind === 'package' ? 'Package' : 'Gig'}
            />
          </View>
        </View>
        <ThemedText
          type="body-lg-semibold"
          style={{ color: theme[950] }}
          numberOfLines={2}
        >
          {title}
        </ThemedText>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <ThemedText type="body-sm" style={{ color: theme[500] }}>
            @{username}
          </ThemedText>
          <ThemedText type="body-sm" style={{ color: theme[500] }}>
            ·
          </ThemedText>
          <ThemedText type="body-sm" style={{ color: theme[500] }}>
            {formatRelative(createdAt)}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

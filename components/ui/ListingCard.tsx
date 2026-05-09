import React from 'react';
import { Pressable, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { formatRelative } from '@/lib/utils/dates';
import { formatSol } from '@/lib/utils/formatNumber';
import { getProfile } from '@/lib/services/profileService';
import { PROFILE_KEYS } from '@/lib/constants/queryKeys';
import { useSaves } from '@/hooks/useSaves';
import { KPI } from './KPI';
import { Pill, type PillIntent } from './Pill';

// Figma node 127:124 — feed card on Browse. Peach gradient hero + KPI + status
// pills + title + meta.

interface ListingCardProps {
  kind: 'service' | 'gig';
  amount: number;
  category: string;
  title: string;
  ownerId: string;       // sellerId or brandId — used to fetch the @username
  createdAt: number;
  /** Explicit cover image. Takes priority over mediaUrls[0]. */
  coverImageUrl?: string | null;
  /** Gallery media. mediaUrls[0] is used as the hero only when coverImageUrl is absent. */
  mediaUrls?: string[];
  /** Listing id — required when the bookmark heart should be shown. */
  listingId?: string;
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
  coverImageUrl,
  mediaUrls,
  listingId,
  onPress,
}: ListingCardProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const saves = useSaves();

  const profileQuery = useQuery({
    queryKey: PROFILE_KEYS.profile(ownerId),
    queryFn: () => getProfile(ownerId),
    staleTime: 60_000,
  });

  const username = profileQuery.data?.username ?? '—';
  const heroUri = coverImageUrl ?? mediaUrls?.[0];
  const saved = listingId ? saves.isSaved(kind, listingId) : false;

  const goToProfile = () => {
    haptic('light');
    router.push(`/profile/${ownerId}`);
  };

  const onToggleSave = () => {
    if (!listingId) return;
    haptic('light');
    saves.toggle(kind, listingId);
  };

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
      {listingId ? (
        <Pressable
          onPress={onToggleSave}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save listing'}
          accessibilityState={{ selected: saved }}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bookmark
            size={18}
            color="#fff"
            fill={saved ? '#fff' : 'transparent'}
            strokeWidth={2}
          />
        </Pressable>
      ) : null}
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <KPI size="md" amount={formatSol(amount)} unit="SOL" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pill intent={categoryToIntent(category)} label={category} />
            <Pill
              intent={kind === 'service' ? 'pink' : 'dark'}
              label={kind === 'service' ? 'Service' : 'Gig'}
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
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Pressable onPress={goToProfile} hitSlop={6}>
            <ThemedText type="body-sm-semibold" style={{ color: theme[700] }}>
              @{username}
            </ThemedText>
          </Pressable>
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

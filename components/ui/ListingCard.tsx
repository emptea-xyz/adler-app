import React from 'react';
import { Pressable, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { Neutral } from '@/constants/NeutralColors';
import { haptic } from '@/lib/utils/haptic';
import { formatRelative } from '@/lib/utils/dates';
import { formatSol } from '@/lib/utils/formatNumber';
import { getProfile } from '@/lib/services/profileService';
import { PROFILE_KEYS } from '@/lib/constants/queryKeys';
import { useSaves } from '@/hooks/useSaves';
import type { ListingOverlay } from '@/lib/types/listing';
import { KPI } from './KPI';
import { Pill, type PillIntent } from './Pill';

// Placeholder gradient when a listing has no hero image. Decorative
// peach → blush tints — intentional one-off, not part of the brand
// palette. Local constants so they don't leak into the design system.
const PLACEHOLDER_GRADIENT_TOP = '#ffd6a8';
const PLACEHOLDER_GRADIENT_BOTTOM = '#ffccd4';

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
  /** Optional studio text overlay metadata for the first video asset. */
  overlay?: ListingOverlay | null;
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

function isVideoUrl(url: string): boolean {
  const value = url.toLowerCase();
  return value.includes('.mp4') || value.includes('.mov') || value.includes('.webm');
}

function ListingCardVideo({ uri, overlay }: { uri: string; overlay?: ListingOverlay | null }) {
  const { theme } = useTheme();
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const x = Math.min(0.92, Math.max(0.08, overlay?.x ?? 0.5));
  const y = Math.min(0.92, Math.max(0.08, overlay?.y ?? 0.5));

  return (
    <View style={{ height: 130, width: '100%', backgroundColor: theme[950] }}>
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="cover"
        style={{ height: '100%', width: '100%' }}
      />
      {overlay?.text ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            transform: [{ translateX: -70 }, { translateY: -14 }, { scale: overlay.scale ?? 1 }],
            width: 140,
            alignItems: 'center',
          }}
        >
          <ThemedText
            type="body-sm-semibold"
            numberOfLines={2}
            align="center"
            style={{ color: overlay.color || theme[50] }}
          >
            {overlay.text}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
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
  overlay,
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
        isVideoUrl(heroUri) ? (
          <ListingCardVideo uri={heroUri} overlay={overlay} />
        ) : (
          <Image
            source={{ uri: heroUri }}
            style={{ height: 130, width: '100%' }}
            resizeMode="cover"
          />
        )
      ) : (
        <LinearGradient
          colors={[PLACEHOLDER_GRADIENT_TOP, PLACEHOLDER_GRADIENT_BOTTOM]}
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
            color={Neutral.white}
            fill={saved ? Neutral.white : 'transparent'}
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

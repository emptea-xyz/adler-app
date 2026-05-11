import React from 'react';
import { View, Image } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { resolveAvatarUrl } from '@/lib/utils/avatars';
import { useTheme } from '@/contexts/ThemeContext';

// Figma node 119:128 — avatar with initial fallback. Three discrete sizes.

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  avatarUrl?: string | null;
  size?: AvatarSize;
  initial?: string;
}

const PX: Record<AvatarSize, number> = { sm: 32, md: 44, lg: 56, xl: 96 };
const TEXT: Record<AvatarSize, 'body-md-semibold' | 'body-xl-semibold' | 'h4' | 'h2'> = {
  sm: 'body-md-semibold',
  md: 'body-xl-semibold',
  lg: 'h4',
  xl: 'h2',
};

export function Avatar({ avatarUrl, size = 'sm', initial }: AvatarProps) {
  const { theme } = useTheme();
  const url = resolveAvatarUrl(avatarUrl ?? null);
  const dim = PX[size];
  const fallback = (initial?.[0] ?? '·').toUpperCase();

  return (
    <View
      style={{
        width: dim,
        height: dim,
        borderRadius: dim / 2,
        backgroundColor: theme[200],
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: dim, height: dim }}
          resizeMode="cover"
        />
      ) : (
        <ThemedText type={TEXT[size]} style={{ color: theme[950] }}>
          {fallback}
        </ThemedText>
      )}
    </View>
  );
}

import React from 'react';
import { View, Image } from 'react-native';
import { resolveAvatarUrl } from '@/lib/utils/avatars';
import { UserRound } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface AvatarProps {
    avatarUrl: string | null | undefined;
    size: number;
}

export function Avatar({ avatarUrl, size }: AvatarProps) {
    const url = resolveAvatarUrl(avatarUrl);
    const { theme } = useTheme();

    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                overflow: 'hidden',
                backgroundColor: theme[300],
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            {url ? (
                <Image
                    source={{ uri: url }}
                    style={{ width: size, height: size }}
                    resizeMode="cover"
                />
            ) : (
                <UserRound size={size * 0.45} color={theme[400]} strokeWidth={1.5} />
            )}
        </View>
    );
}

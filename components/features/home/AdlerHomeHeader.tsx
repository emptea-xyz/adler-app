import React from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';

interface AdlerHomeHeaderProps {
    title: string;
    /** Optional slot rendered on the right (e.g. a settings cog). */
    rightSlot?: React.ReactNode;
}

export function AdlerHomeHeader({ title, rightSlot }: AdlerHomeHeaderProps) {
    const { theme } = useTheme();

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: theme[50],
            }}
        >
            <ThemedText type="h4" style={{ color: theme[950] }} numberOfLines={1}>
                {title}
            </ThemedText>
            {rightSlot ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {rightSlot}
                </View>
            ) : null}
        </View>
    );
}

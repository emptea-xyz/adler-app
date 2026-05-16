import React, { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';

interface ListRowProps {
    title: string;
    subtitle?: string;
    leading?: ReactNode;
    trailing?: ReactNode;
    onPress?: () => void;
    /** Whether a 1px bottom-border separator is drawn (defaults to true). */
    borderBottom?: boolean;
    accessibilityLabel?: string;
    paddingX?: number;
    paddingY?: number;
}

/**
 * Compact row primitive: optional leading visual, stacked title/subtitle,
 * optional trailing slot, optional onPress. Use for any pressable or
 * informational row inside a card or list section.
 */
export function ListRow({
    title,
    subtitle,
    leading,
    trailing,
    onPress,
    borderBottom = true,
    accessibilityLabel,
    paddingX = 0,
    paddingY = 12,
}: ListRowProps) {
    const { theme } = useTheme();
    const content = (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingHorizontal: paddingX,
                paddingVertical: paddingY,
                borderBottomWidth: borderBottom ? 1 : 0,
                borderBottomColor: theme[100],
            }}
        >
            {leading}
            <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="body-md-semibold" style={{ color: theme[950] }} numberOfLines={1}>
                    {title}
                </ThemedText>
                {subtitle ? (
                    <ThemedText type="caption" style={{ color: theme[500] }} numberOfLines={1}>
                        {subtitle}
                    </ThemedText>
                ) : null}
            </View>
            {trailing}
        </View>
    );

    if (!onPress) return content;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
            {content}
        </Pressable>
    );
}

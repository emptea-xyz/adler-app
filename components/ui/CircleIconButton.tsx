import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { ICON_BUTTON_SIZE, ICON_BUTTON_RADIUS } from '@/constants/LayoutConstants';

interface CircleIconButtonProps {
    icon: IconName;
    onPress: () => void;
    accessibilityLabel: string;
    /** Optional unread/notification badge. 0 hides. */
    badgeCount?: number;
    /** Override the icon glyph size (default 20). */
    iconSize?: number;
}

export function CircleIconButton({
    icon,
    onPress,
    accessibilityLabel,
    badgeCount = 0,
    iconSize = 20,
}: CircleIconButtonProps) {
    const { theme } = useTheme();

    return (
        <Pressable
            onPress={() => {
                haptic('light');
                onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={
                badgeCount > 0
                    ? `${accessibilityLabel}, ${badgeCount} unread`
                    : accessibilityLabel
            }
            style={{
                width: ICON_BUTTON_SIZE,
                height: ICON_BUTTON_SIZE,
                borderRadius: ICON_BUTTON_RADIUS,
                backgroundColor: theme[100],
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Icon name={icon} size={iconSize} color={theme[950]} />
            {badgeCount > 0 ? (
                <View
                    style={{
                        position: 'absolute',
                        top: 3,
                        right: 4,
                        minWidth: 14,
                        height: 14,
                        borderRadius: 7,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme[950],
                        paddingHorizontal: 2,
                    }}
                >
                    <ThemedText
                        type="caption-semibold"
                        style={{ color: theme[50], fontSize: 9 }}
                    >
                        {badgeCount > 9 ? '9+' : String(badgeCount)}
                    </ThemedText>
                </View>
            ) : null}
        </Pressable>
    );
}

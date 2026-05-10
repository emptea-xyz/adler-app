import React from 'react';
import { Pressable, View, type ColorValue } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { Neutral } from '@/constants/NeutralColors';
import { haptic } from '@/lib/utils/haptic';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ActionTileProps {
    icon: IconName;
    iconBgColor: ColorValue;
    iconColor?: ColorValue;
    title: string;
    subtitle: string;
    onPress: () => void;
    disabled?: boolean;
}

export function ActionTile({
    icon,
    iconBgColor,
    iconColor = Neutral.white,
    title,
    subtitle,
    onPress,
    disabled = false,
}: ActionTileProps) {
    const { theme } = useTheme();
    const scale = useSharedValue(1);
    const scaleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            onPress={() => {
                if (disabled) return;
                haptic('light');
                onPress();
            }}
            onPressIn={() => {
                if (disabled) return;
                scale.value = withTiming(0.97, { duration: 100, easing: Easing.out(Easing.quad) });
            }}
            onPressOut={() => {
                scale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) });
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${subtitle}`}
            style={[
                {
                    flex: 1,
                    minHeight: 152,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: theme[200],
                    backgroundColor: theme[50],
                    padding: 16,
                    justifyContent: 'space-between',
                    opacity: disabled ? 0.5 : 1,
                },
                scaleStyle,
            ]}
        >
            <View
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: iconBgColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Icon name={icon} size={22} color={iconColor} weight="semibold" />
            </View>
            <View style={{ gap: 2 }}>
                <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                    {title}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme[500] }}>
                    {subtitle}
                </ThemedText>
            </View>
        </AnimatedPressable>
    );
}

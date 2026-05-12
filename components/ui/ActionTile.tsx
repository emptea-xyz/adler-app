import React from 'react';
import { Pressable, View, type ColorValue } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { Neutral } from '@/constants/NeutralColors';
import { haptic } from '@/lib/utils/haptic';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ActionTileIconPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface ActionTileProps {
    icon: IconName;
    iconBgColor: ColorValue;
    iconColor?: ColorValue;
    title: string;
    subtitle: string;
    onPress: () => void;
    disabled?: boolean;
    iconPosition?: ActionTileIconPosition;
}

export function ActionTile({
    icon,
    iconBgColor,
    iconColor = Neutral.white,
    title,
    subtitle,
    onPress,
    disabled = false,
    iconPosition = 'top-left',
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
                    opacity: disabled ? 0.5 : 1,
                },
                scaleStyle,
            ]}
        >
            <View
                style={{
                    position: 'absolute',
                    top: iconPosition.startsWith('top') ? 16 : undefined,
                    bottom: iconPosition.startsWith('bottom') ? 16 : undefined,
                    left: iconPosition.endsWith('left') ? 16 : undefined,
                    right: iconPosition.endsWith('right') ? 16 : undefined,
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
            <View
                style={{
                    position: 'absolute',
                    top: iconPosition.startsWith('bottom') ? 16 : undefined,
                    bottom: iconPosition.startsWith('top') ? 16 : undefined,
                    left: iconPosition.endsWith('right') ? 16 : undefined,
                    right: iconPosition.endsWith('left') ? 16 : undefined,
                    maxWidth: '70%',
                    gap: 2,
                    alignItems: iconPosition.endsWith('left') ? 'flex-end' : 'flex-start',
                }}
            >
                <ThemedText
                    type="body-md-semibold"
                    style={{
                        color: theme[950],
                        textAlign: iconPosition.endsWith('left') ? 'right' : 'left',
                    }}
                >
                    {title}
                </ThemedText>
                <ThemedText
                    type="caption"
                    style={{
                        color: theme[500],
                        textAlign: iconPosition.endsWith('left') ? 'right' : 'left',
                    }}
                >
                    {subtitle}
                </ThemedText>
            </View>
        </AnimatedPressable>
    );
}

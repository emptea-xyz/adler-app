import React from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
interface ScreenFadeInProps {
    children: React.ReactNode;
    duration?: number;
    delay?: number;
    style?: any;
}

/**
 * ScreenFadeIn - Quick fade-in wrapper for page transitions.
 * Standardizes the entrance animation for screens.
 */
export function ScreenFadeIn({
    children,
    duration = 120,
    delay = 0,
    style
}: ScreenFadeInProps) {
    return (
        <Animated.View
            entering={FadeIn.duration(duration).delay(delay)}
            style={[{ flex: 1 }, style]}
        >
            {children}
        </Animated.View>
    );
}

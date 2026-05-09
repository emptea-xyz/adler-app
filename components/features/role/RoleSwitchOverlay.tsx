import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useViewMode } from '@/contexts/ViewModeContext';

export function RoleSwitchOverlay() {
    const colorScheme = useColorScheme() ?? 'light';
    const { isTransitioning } = useViewMode();

    const overlayStyle = useAnimatedStyle(() => {
        const opacity = isTransitioning.value
            ? withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) })
            : withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
        return { opacity };
    }, [isTransitioning]);

    const isDark = colorScheme === 'dark';

    return (
        <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
            <BlurView
                intensity={20}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
            />
            <View style={[styles.scrim, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }]} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
    },
});
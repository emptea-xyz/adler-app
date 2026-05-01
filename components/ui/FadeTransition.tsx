/**
 * FadeTransition - Cross-fade wrapper for loading states.
 *
 * Features:
 * - Three states: loading, ready, error
 * - Cross-fade transition with 150ms duration
 * - Minimum loader visibility (~140ms) to prevent flicker
 * - Content mounted immediately with opacity 0 (no render delay)
 * - Cached data shows content immediately
 * - Proper layout flow - content provides height, skeleton overlays
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
export type AsyncState = 'loading' | 'ready' | 'error';

const FADE_DURATION = 120; // ms - snappy crossfade
const MIN_LOADER_TIME = 50; // ms - prevent skeleton flicker on fast loads

interface FadeTransitionProps {
    /** Current state of async operation */
    state: AsyncState;
    /** Skeleton placeholder shown during loading */
    skeleton?: React.ReactNode;
    /** Error state UI */
    error?: React.ReactNode;
    /** Content to show when ready */
    children: React.ReactNode;
    /** Minimum time to show loader (prevents flicker) */
    minLoaderTime?: number;
    /** Optional style for the outer container */
    style?: StyleProp<ViewStyle>;
    /** Optional style for the content wrapper */
    contentStyle?: StyleProp<ViewStyle>;
}

export function FadeTransition({
    state,
    skeleton,
    error,
    children,
    minLoaderTime = MIN_LOADER_TIME,
    style,
    contentStyle: userContentStyle,
}: FadeTransitionProps) {
    // ... rest of the function remains the same ...
    // Track if we've ever shown loading state
    const hasShownLoader = useRef(false);
    const loaderStartTime = useRef<number | null>(null);

    // Animated opacity values
    const skeletonOpacity = useSharedValue(state === 'loading' ? 1 : 0);
    const contentOpacity = useSharedValue(state === 'ready' ? 1 : 0);
    const errorOpacity = useSharedValue(state === 'error' ? 1 : 0);

    // Track if content was already available (cached data)
    const wasInitiallyReady = useRef(state === 'ready');

    useEffect(() => {
        const timingConfig = {
            duration: FADE_DURATION,
            easing: Easing.inOut(Easing.ease),
        };

        if (state === 'loading') {
            hasShownLoader.current = true;
            loaderStartTime.current = Date.now();

            // Fade in skeleton, fade out others
            skeletonOpacity.value = withTiming(1, timingConfig);
            contentOpacity.value = withTiming(0, timingConfig);
            errorOpacity.value = withTiming(0, timingConfig);
        } else if (state === 'ready') {
            // If data was cached (never showed loader), show content immediately
            if (!hasShownLoader.current || wasInitiallyReady.current) {
                skeletonOpacity.value = 0;
                contentOpacity.value = 1;
                errorOpacity.value = 0;
                return;
            }

            // Calculate remaining time for minimum loader visibility
            const elapsed = loaderStartTime.current
                ? Date.now() - loaderStartTime.current
                : minLoaderTime;
            const remainingTime = Math.max(0, minLoaderTime - elapsed);

            // Delay transition if minimum time not met
            const doTransition = () => {
                skeletonOpacity.value = withTiming(0, timingConfig);
                contentOpacity.value = withTiming(1, timingConfig);
                errorOpacity.value = withTiming(0, timingConfig);
            };

            if (remainingTime > 0) {
                const timeout = setTimeout(doTransition, remainingTime);
                return () => clearTimeout(timeout);
            } else {
                doTransition();
            }
        } else if (state === 'error') {
            // Fade in error, fade out others
            skeletonOpacity.value = withTiming(0, timingConfig);
            contentOpacity.value = withTiming(0, timingConfig);
            errorOpacity.value = withTiming(1, timingConfig);
        }
    }, [state, skeletonOpacity, contentOpacity, errorOpacity, minLoaderTime]);

    const skeletonStyle = useAnimatedStyle(() => ({
        opacity: skeletonOpacity.value,
    }));

    const contentAnimatedStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
    }));

    const errorStyle = useAnimatedStyle(() => ({
        opacity: errorOpacity.value,
    }));

    // When loading or error, show skeleton/error with content hidden but still measuring
    // Content is always in the layout flow to provide proper height
    return (
        <View style={[styles.container, style]}>
            {/* Content layer - ALWAYS in layout flow for proper sizing */}
            <Animated.View style={[contentAnimatedStyle, userContentStyle]}>
                {children}
            </Animated.View>

            {/* Skeleton layer - absolutely positioned overlay */}
            {skeleton && state === 'loading' && (
                <Animated.View
                    style={[styles.overlay, skeletonStyle]}
                    pointerEvents={state === 'loading' ? 'auto' : 'none'}
                >
                    {skeleton}
                </Animated.View>
            )}

            {/* Error layer - absolutely positioned overlay */}
            {error && state === 'error' && (
                <Animated.View
                    style={[styles.overlay, errorStyle]}
                    pointerEvents={state === 'error' ? 'auto' : 'none'}
                >
                    {error}
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
});

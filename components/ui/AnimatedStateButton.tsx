import React, { type ReactNode, useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { Status } from '@/constants/StatusColors';

interface AnimatedStateButtonProps {
    state: 'idle' | 'success';
    idleBg: string;
    successBg?: string;
    height?: number;
    disabled?: boolean;
    onPress: () => void;
    accessibilityLabel?: string;
    idle: ReactNode;
    success: ReactNode;
    /** Inner content gap. */
    contentGap?: number;
    /** Inner content horizontal padding. */
    contentPaddingX?: number;
}

const baseAbsoluteCenter = (gap: number, paddingX: number) =>
    ({
        position: 'absolute' as const,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        gap,
        paddingHorizontal: paddingX,
    });

/**
 * Pill button that cross-fades between an idle and a success layout, with
 * an animated background-color transition between the two states. Used by
 * one-shot affordances (copy address, share win) where success is a brief
 * confirmation before the button resets to idle.
 */
export function AnimatedStateButton({
    state,
    idleBg,
    successBg = Status.success,
    height = 48,
    disabled = false,
    onPress,
    accessibilityLabel,
    idle,
    success,
    contentGap = 8,
    contentPaddingX = 16,
}: AnimatedStateButtonProps) {
    const absoluteCenter = baseAbsoluteCenter(contentGap, contentPaddingX);
    const bg = state === 'success' ? successBg : idleBg;

    const bgStyle = useAnimatedStyle(
        () => ({
            backgroundColor: withTiming(bg, {
                duration: 220,
                easing: Easing.out(Easing.cubic),
            }),
        }),
        [bg],
    );

    const idleOpacity = useSharedValue(1);
    const successOpacity = useSharedValue(0);
    useEffect(() => {
        const t = { duration: 200, easing: Easing.out(Easing.cubic) };
        idleOpacity.value = withTiming(state === 'idle' ? 1 : 0, t);
        successOpacity.value = withTiming(state === 'success' ? 1 : 0, t);
    }, [state, idleOpacity, successOpacity]);

    const idleStyle = useAnimatedStyle(() => ({ opacity: idleOpacity.value }));
    const successStyle = useAnimatedStyle(() => ({ opacity: successOpacity.value }));

    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled }}
        >
            <Animated.View
                style={[
                    {
                        height,
                        borderRadius: 9999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                    },
                    bgStyle,
                ]}
            >
                <Animated.View style={[absoluteCenter, idleStyle]}>{idle}</Animated.View>
                <Animated.View style={[absoluteCenter, successStyle]}>{success}</Animated.View>
            </Animated.View>
        </Pressable>
    );
}

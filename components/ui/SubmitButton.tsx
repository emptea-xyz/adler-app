import React, { useEffect } from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/base/ThemedText';
import { Neutral } from '@/constants/NeutralColors';
import { Status } from '@/constants/StatusColors';
import { useTheme } from '@/contexts/ThemeContext';

export type SubmitButtonState = 'idle' | 'success' | 'error';

interface SubmitButtonProps {
    /** Label shown in the resting (idle) state. */
    idleLabel: string;
    /** Optional label shown when state === 'success'. Defaults to idleLabel. */
    successLabel?: string;
    /** Optional label shown when state === 'error'. Defaults to idleLabel. */
    errorLabel?: string;
    /** Label shown while `loading` is true. Defaults to idleLabel. */
    loadingLabel?: string;
    state?: SubmitButtonState;
    loading?: boolean;
    disabled?: boolean;
    onPress: () => void;
}

/**
 * Full-width primary submit button with animated success/error states.
 * The fill cross-fades to Status.success / Status.error and the label
 * cross-fades between the three slots. Used by PostBountySheet,
 * AddMemberSheet, etc. — anything where the submit has to acknowledge
 * an out-of-band outcome inline.
 */
export function SubmitButton({
    idleLabel,
    successLabel,
    errorLabel,
    loadingLabel,
    state = 'idle',
    loading = false,
    disabled = false,
    onPress,
}: SubmitButtonProps) {
    const { theme } = useTheme();

    const idleBg = disabled ? theme[300] : theme[950];
    const bg =
        state === 'success' ? Status.success : state === 'error' ? Status.error : idleBg;

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
    const errorOpacity = useSharedValue(0);
    useEffect(() => {
        const t = { duration: 200, easing: Easing.out(Easing.cubic) };
        idleOpacity.value = withTiming(state === 'idle' ? 1 : 0, t);
        successOpacity.value = withTiming(state === 'success' ? 1 : 0, t);
        errorOpacity.value = withTiming(state === 'error' ? 1 : 0, t);
    }, [state, idleOpacity, successOpacity, errorOpacity]);

    const idleStyle = useAnimatedStyle(() => ({ opacity: idleOpacity.value }));
    const successStyle = useAnimatedStyle(() => ({ opacity: successOpacity.value }));
    const errorStyle = useAnimatedStyle(() => ({ opacity: errorOpacity.value }));

    const isInteractive = state === 'idle' && !disabled && !loading;
    const idleText = loading ? (loadingLabel ?? idleLabel) : idleLabel;

    return (
        <Pressable onPress={isInteractive ? onPress : undefined} disabled={!isInteractive}>
            <Animated.View
                style={[
                    {
                        height: 56,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                    },
                    bgStyle,
                ]}
            >
                <Animated.View style={[ABSOLUTE_CENTER, idleStyle]}>
                    <ThemedText
                        type="body-md-semibold"
                        style={{ color: theme[50] }}
                        numberOfLines={1}
                    >
                        {idleText}
                    </ThemedText>
                </Animated.View>
                <Animated.View style={[ABSOLUTE_CENTER, successStyle]}>
                    <ThemedText
                        type="body-md-semibold"
                        style={{ color: Neutral.white }}
                        numberOfLines={1}
                    >
                        {successLabel ?? idleLabel}
                    </ThemedText>
                </Animated.View>
                <Animated.View style={[ABSOLUTE_CENTER, errorStyle]}>
                    <ThemedText
                        type="body-md-semibold"
                        style={{ color: Neutral.white }}
                        numberOfLines={1}
                    >
                        {errorLabel ?? idleLabel}
                    </ThemedText>
                </Animated.View>
            </Animated.View>
        </Pressable>
    );
}

const ABSOLUTE_CENTER: ViewStyle = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
};

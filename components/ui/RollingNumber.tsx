import React, { useEffect } from 'react';
import { View, type TextStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/base/ThemedText';

/**
 * Per-digit slot machine. Each '0'-'9' character lives in a clipped column
 * and slides vertically to the target digit when the value changes. Non-
 * digit characters (',', '.', etc.) render statically — they don't need to
 * roll because they only appear at fixed positions in a formatted number.
 */
interface RollingDigitProps {
    digit: number;
    height: number;
    color: string;
    fontSize: number;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function RollingDigit({ digit, height, color, fontSize }: RollingDigitProps) {
    const offset = useSharedValue(-digit * height);

    useEffect(() => {
        offset.value = withTiming(-digit * height, {
            duration: 420,
            easing: Easing.out(Easing.cubic),
        });
    }, [digit, height, offset]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: offset.value }],
    }));

    const textStyle: TextStyle = {
        color,
        fontSize,
        lineHeight: height,
        height,
        textAlign: 'center',
    };

    return (
        <View style={{ height, overflow: 'hidden' }}>
            <Animated.View style={animatedStyle}>
                {DIGITS.map((d) => (
                    <ThemedText key={d} type="h1" style={textStyle}>
                        {d}
                    </ThemedText>
                ))}
            </Animated.View>
        </View>
    );
}

interface RollingNumberProps {
    /** Formatted string (e.g. "1,234"). Digits roll; separators stay put. */
    value: string;
    color: string;
    fontSize: number;
    lineHeight: number;
}

export function RollingNumber({ value, color, fontSize, lineHeight }: RollingNumberProps) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            {value.split('').map((ch, i) => {
                if (/[0-9]/.test(ch)) {
                    return (
                        <RollingDigit
                            key={`d-${i}`}
                            digit={Number(ch)}
                            height={lineHeight}
                            color={color}
                            fontSize={fontSize}
                        />
                    );
                }
                return (
                    <ThemedText
                        key={`s-${i}-${ch}`}
                        type="h1"
                        style={{ color, fontSize, lineHeight }}
                    >
                        {ch}
                    </ThemedText>
                );
            })}
        </View>
    );
}

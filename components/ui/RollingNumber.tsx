import React, { useEffect } from 'react';
import { View, type TextStyle } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/base/ThemedText';

/**
 * Per-digit slot machine. Each '0'-'9' slot is its own clipped column that
 * slides vertically to the new digit; sibling slots animate their x-
 * position via Reanimated's LinearTransition so digits + the decimal point
 * smoothly redistribute when the value's length changes. Each cell auto-
 * sizes to the widest digit (all 10 are stacked but only one row visible)
 * so the column width matches that digit's natural glyph width.
 */
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const SLIDE_MS = 420;
const SLIDE_EASING = Easing.out(Easing.cubic);
const LETTER_SPACING_RATIO = -0.03;

interface RollingDigitProps {
    digit: number;
    height: number;
    color: string;
    fontSize: number;
}

function colorAt(idx: number, dotIdx: number, color: string, decimalColor?: string) {
    if (!decimalColor || dotIdx < 0) return color;
    return idx > dotIdx ? decimalColor : color;
}

function RollingDigit({ digit, height, color, fontSize }: RollingDigitProps) {
    const offset = useSharedValue(-digit * height);

    useEffect(() => {
        offset.value = withTiming(-digit * height, {
            duration: SLIDE_MS,
            easing: SLIDE_EASING,
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
        letterSpacing: fontSize * LETTER_SPACING_RATIO,
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
    /** Formatted string. Digits roll; '.' and any other glyph stays put. */
    value: string;
    color: string;
    /** If set, glyphs after the first '.' use this color. */
    decimalColor?: string;
    fontSize: number;
    lineHeight: number;
}

const cellTransition = LinearTransition.duration(SLIDE_MS).easing(SLIDE_EASING);
const cellEntering = FadeIn.duration(SLIDE_MS);
const cellExiting = FadeOut.duration(SLIDE_MS / 2);

export function RollingNumber({
    value,
    color,
    decimalColor,
    fontSize,
    lineHeight,
}: RollingNumberProps) {
    const chars = value.split('');
    const dotIdx = chars.indexOf('.');
    // Stable keys are anchored to the dot (or the right edge when there is
    // none) so a new high-order digit slides in from the left without
    // re-keying the existing ones-place digit. The eye tracks value, not
    // index.
    const anchor = dotIdx >= 0 ? dotIdx : chars.length;
    return (
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            {chars.map((ch, i) => {
                const offsetFromAnchor = i - anchor;
                const isDigit = /[0-9]/.test(ch);
                const key = isDigit
                    ? `d-${offsetFromAnchor}`
                    : `s-${offsetFromAnchor}-${ch}`;
                const c = colorAt(i, dotIdx, color, decimalColor);
                return (
                    <Animated.View
                        key={key}
                        layout={cellTransition}
                        entering={cellEntering}
                        exiting={cellExiting}
                    >
                        {isDigit ? (
                            <RollingDigit
                                digit={Number(ch)}
                                height={lineHeight}
                                color={c}
                                fontSize={fontSize}
                            />
                        ) : (
                            <ThemedText
                                type="h1"
                                style={{
                                    color: c,
                                    fontSize,
                                    lineHeight,
                                    letterSpacing: fontSize * LETTER_SPACING_RATIO,
                                }}
                            >
                                {ch}
                            </ThemedText>
                        )}
                    </Animated.View>
                );
            })}
        </View>
    );
}

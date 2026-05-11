import React, { useEffect, useState } from "react";
import { View, Pressable, type ColorValue } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from "react-native-reanimated";
import { ThemedText } from "@/components/base/ThemedText";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useTheme } from "@/contexts/ThemeContext";
import { haptic } from "@/lib/utils/haptic";
import { cn } from "@/lib/utils/cn";

type Size = "xs" | "sm" | "md";

interface SegmentedToggleProps<T extends string> {
    tabs: readonly T[];
    activeTab: T;
    onTabChange: (tab: T) => void;
    size?: Size;
    className?: string;
    /** Optional SF Symbol per tab. When provided, renders icon-only (label used for a11y). */
    icons?: readonly IconName[];
    disabled?: boolean;
    /** Override the active pill background. Defaults to `theme[950]`. */
    activeColor?: ColorValue;
    /** Override the active foreground (text/icon). Defaults to `theme[50]`. */
    activeForegroundColor?: ColorValue;
    /** Override the inactive foreground (text/icon). Defaults to `theme[600]`. */
    inactiveForegroundColor?: ColorValue;
    /** Override the container background. Defaults to `theme[100]`. */
    backgroundColor?: ColorValue;
}

const sizeConfig = {
    xs: {
        pad: 2,
        container: "flex-row rounded-full p-0.5",
        pill: "absolute top-0.5 bottom-0.5 rounded-full",
        pressable: "flex-1 items-center justify-center aspect-square",
        text: "caption-semibold" as const,
        iconSize: 15,
    },
    sm: {
        pad: 2,
        container: "flex-row rounded-lg p-0.5",
        pill: "absolute top-0.5 bottom-0.5 rounded-md",
        pressable: "flex-1 py-2 items-center justify-center",
        text: "caption-semibold" as const,
        iconSize: 18,
    },
    md: {
        pad: 4,
        container: "flex-row rounded-card p-1",
        pill: "absolute top-1 bottom-1 rounded-card",
        pressable: "flex-1 py-2 items-center justify-center",
        text: "body-sm-semibold" as const,
        iconSize: 20,
    },
};

export function SegmentedToggle<T extends string>({
    tabs,
    activeTab,
    onTabChange,
    size = "md",
    className,
    icons,
    disabled,
    activeColor,
    activeForegroundColor,
    inactiveForegroundColor,
    backgroundColor,
}: SegmentedToggleProps<T>) {
    const { theme } = useTheme();
    const animIdx = useSharedValue(tabs.indexOf(activeTab));
    const [containerWidth, setContainerWidth] = useState(0);
    const config = sizeConfig[size];

    // Keep the pill in sync when activeTab is changed externally (e.g.
    // forcing 'Manual' when the sibling Photo/Link toggle flips to Link).
    useEffect(() => {
        animIdx.value = tabs.indexOf(activeTab);
    }, [activeTab, tabs, animIdx]);

    const pillStyle = useAnimatedStyle(() => {
        if (containerWidth === 0) return { opacity: 0 };
        const innerWidth = containerWidth - config.pad * 2;
        const segmentWidth = innerWidth / tabs.length;
        return {
            width: segmentWidth,
            left: withTiming(config.pad + animIdx.value * segmentWidth, {
                duration: 250,
                easing: Easing.out(Easing.cubic),
            }),
            opacity: 1,
        };
    });

    const handlePress = (tab: T) => {
        if (disabled) return;
        haptic("light");
        onTabChange(tab);
        animIdx.value = tabs.indexOf(tab);
    };

    return (
        <View
            className={cn(config.container, className)}
            style={{ backgroundColor: backgroundColor ?? theme[100], opacity: disabled ? 0.5 : 1 }}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
            <Animated.View
                className={config.pill}
                style={[pillStyle, { backgroundColor: activeColor ?? theme[950] }]}
            />
            {tabs.map((tab, i) => {
                const active = activeTab === tab;
                const tint = active
                    ? (activeForegroundColor ?? theme[50])
                    : (inactiveForegroundColor ?? theme[600]);
                return (
                    <Pressable
                        key={tab}
                        onPress={() => handlePress(tab)}
                        className={config.pressable}
                        accessibilityRole="button"
                        accessibilityLabel={tab}
                        accessibilityState={{ selected: active, disabled: !!disabled }}
                    >
                        {icons ? (
                            <Icon name={icons[i]} size={config.iconSize} color={tint} />
                        ) : (
                            <ThemedText type={config.text} style={{ color: tint }}>
                                {tab}
                            </ThemedText>
                        )}
                    </Pressable>
                );
            })}
        </View>
    );
}

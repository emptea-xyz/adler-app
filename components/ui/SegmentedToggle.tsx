import React, { useState } from "react";
import { View, Pressable } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from "react-native-reanimated";
import { ThemedText } from "@/components/base/ThemedText";
import { useTheme } from "@/contexts/ThemeContext";
import { haptic } from "@/lib/utils/haptic";
import { cn } from "@/lib/utils/cn";

type Size = "sm" | "md";

interface SegmentedToggleProps<T extends string> {
    tabs: readonly T[];
    activeTab: T;
    onTabChange: (tab: T) => void;
    size?: Size;
    className?: string;
}

const sizeConfig = {
    sm: {
        pad: 2,
        container: "flex-row rounded-lg p-0.5",
        pill: "absolute top-0.5 bottom-0.5 rounded-md",
        pressable: "flex-1 py-2 items-center",
        text: "caption-semibold" as const,
    },
    md: {
        pad: 4,
        container: "flex-row rounded-card p-1",
        pill: "absolute top-1 bottom-1 rounded-card",
        pressable: "flex-1 py-2 items-center",
        text: "body-sm-semibold" as const,
    },
};

export function SegmentedToggle<T extends string>({
    tabs,
    activeTab,
    onTabChange,
    size = "md",
    className,
}: SegmentedToggleProps<T>) {
    const { theme } = useTheme();
    const animIdx = useSharedValue(tabs.indexOf(activeTab));
    const [containerWidth, setContainerWidth] = useState(0);
    const config = sizeConfig[size];

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
        haptic("light");
        onTabChange(tab);
        animIdx.value = tabs.indexOf(tab);
    };

    return (
        <View
            className={cn(config.container, className)}
            style={{ backgroundColor: theme[100] }}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
            <Animated.View
                className={config.pill}
                style={[pillStyle, { backgroundColor: theme[950] }]}
            />
            {tabs.map((tab) => (
                <Pressable
                    key={tab}
                    onPress={() => handlePress(tab)}
                    className={config.pressable}
                >
                    <ThemedText
                        type={config.text}
                        style={{ color: activeTab === tab ? theme[50] : theme[600] }}
                    >
                        {tab}
                    </ThemedText>
                </Pressable>
            ))}
        </View>
    );
}

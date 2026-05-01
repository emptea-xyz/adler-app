import React from "react";
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

interface UnderlineTabBarProps<T extends string> {
    tabs: readonly T[];
    activeTab: T;
    onTabChange: (tab: T) => void;
    className?: string;
}

export function UnderlineTabBar<T extends string>({
    tabs,
    activeTab,
    onTabChange,
    className,
}: UnderlineTabBarProps<T>) {
    const { theme } = useTheme();
    const segmentWidth = useSharedValue(0);
    const animIdx = useSharedValue(tabs.indexOf(activeTab));

    const timingConfig = { duration: 250, easing: Easing.out(Easing.cubic) };

    const handlePress = (tab: T) => {
        haptic("light");
        onTabChange(tab);
        animIdx.value = withTiming(tabs.indexOf(tab), timingConfig);
    };

    const underlineStyle = useAnimatedStyle(() => {
        const w = segmentWidth.value;
        if (w === 0) return { opacity: 0 };
        return {
            position: "absolute" as const,
            bottom: 0,
            height: 1,
            width: w,
            left: animIdx.value * w,
            backgroundColor: theme[950],
            opacity: 1,
        };
    });

    return (
        <View
            className={className}
            onLayout={(e) => {
                segmentWidth.value = e.nativeEvent.layout.width / tabs.length;
            }}
        >
            <View className="flex-row">
                {tabs.map((tab) => (
                    <Pressable
                        key={tab}
                        onPress={() => handlePress(tab)}
                        className="flex-1 items-center pb-2"
                    >
                        <ThemedText
                            type="body-sm"
                            style={{
                                color: activeTab === tab ? theme[950] : theme[400],
                                letterSpacing: -0.5,
                            }}
                        >
                            {tab}
                        </ThemedText>
                    </Pressable>
                ))}
            </View>
            <View className="relative">
                <View
                    className="h-px w-full"
                    style={{ backgroundColor: theme[200] }}
                />
                <Animated.View style={underlineStyle} />
            </View>
        </View>
    );
}

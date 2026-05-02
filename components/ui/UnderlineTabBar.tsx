import React from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/base/ThemedText";
import { useTheme } from "@/contexts/ThemeContext";
import { haptic } from "@/lib/utils/haptic";
import { ACCENT_COLORS } from "@/constants/ThemePalettes";

// Figma frame 12:33 — left-aligned label tabs with a 32×2 pink indicator under
// the active label. No full-width track.

interface UnderlineTabBarProps<T extends string> {
    tabs: readonly T[];
    activeTab: T;
    onTabChange: (tab: T) => void;
    className?: string;
    indicatorColor?: string;
}

export function UnderlineTabBar<T extends string>({
    tabs,
    activeTab,
    onTabChange,
    className,
    indicatorColor = ACCENT_COLORS.pink,
}: UnderlineTabBarProps<T>) {
    const { theme } = useTheme();

    const handlePress = (tab: T) => {
        haptic("light");
        onTabChange(tab);
    };

    return (
        <View
            className={className}
            style={{ flexDirection: "row", gap: 24 }}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab;
                return (
                    <Pressable
                        key={tab}
                        onPress={() => handlePress(tab)}
                        style={{
                            paddingVertical: 8,
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <ThemedText
                            type="body-sm-semibold"
                            style={{ color: isActive ? theme[950] : theme[400] }}
                        >
                            {tab}
                        </ThemedText>
                        <View
                            style={{
                                width: 32,
                                height: 2,
                                borderRadius: 1,
                                backgroundColor: isActive ? indicatorColor : "transparent",
                            }}
                        />
                    </Pressable>
                );
            })}
        </View>
    );
}

import React, { useState, useRef, useCallback } from "react";
import {
    View,
    Pressable,
    Modal,
    TouchableWithoutFeedback,
    useWindowDimensions,
} from "react-native";
import { ThemedText } from "@/components/base/ThemedText";
import { useTheme } from "@/contexts/ThemeContext";
import { Check } from "lucide-react-native";
import { ThemeColors } from "@/constants/ThemeColors";
import { Neutral } from "@/constants/NeutralColors";
import { haptic } from "@/lib/utils/haptic";

const MENU_ITEM_HEIGHT = 40;
const MENU_PADDING = 16;
const SCREEN_EDGE_MARGIN = 12;
const MENU_MIN_WIDTH = 160;

export interface PopoverMenuItem {
    label: string;
    icon?: React.ComponentType<{ size: number; color: string }>;
    onPress: () => void;
    destructive?: boolean;
    selected?: boolean;
}

interface PopoverMenuProps {
    items: PopoverMenuItem[];
    children: React.ReactElement;
}

export function PopoverMenu({ items, children }: PopoverMenuProps) {
    const { theme } = useTheme();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<View>(null);

    const handleOpen = useCallback(() => {
        triggerRef.current?.measureInWindow((x, y, width, height) => {
            const menuWidth = Math.max(width, MENU_MIN_WIDTH);
            const menuHeight = items.length * MENU_ITEM_HEIGHT + MENU_PADDING;

            // Preferred: below the trigger
            let posY = y + height + 4;
            // If it overflows below, show above the trigger
            if (posY + menuHeight > screenHeight - SCREEN_EDGE_MARGIN) {
                posY = y - menuHeight - 4;
            }
            // Clamp so it never goes off-screen
            posY = Math.max(SCREEN_EDGE_MARGIN, Math.min(posY, screenHeight - menuHeight - SCREEN_EDGE_MARGIN));

            // Horizontal: clamp to screen edges
            let posX = x;
            if (posX + menuWidth > screenWidth - SCREEN_EDGE_MARGIN) {
                posX = screenWidth - menuWidth - SCREEN_EDGE_MARGIN;
            }
            posX = Math.max(SCREEN_EDGE_MARGIN, posX);

            setMenuPos({ x: posX, y: posY });
            setOpen(true);
        });
        haptic("light");
    }, [items.length, screenWidth, screenHeight]);

    const handleSelect = useCallback((item: PopoverMenuItem) => {
        haptic("light");
        setOpen(false);
        item.onPress();
    }, []);

    return (
        <>
            <Pressable onPress={handleOpen} accessibilityRole="button" accessibilityLabel="Menu">
                <View ref={triggerRef}>
                    {children}
                </View>
            </Pressable>

            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <TouchableWithoutFeedback onPress={() => setOpen(false)}>
                    <View className="flex-1">
                        <View
                            style={{
                                position: "absolute",
                                top: menuPos.y,
                                left: menuPos.x,
                                minWidth: MENU_MIN_WIDTH,
                                backgroundColor: theme[50],
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: theme[200],
                                shadowColor: Neutral.black,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.12,
                                shadowRadius: 12,
                                elevation: 8,
                                overflow: "hidden",
                            }}
                        >
                            {items.map((item, index) => {
                                const isLast = index === items.length - 1;
                                const color = item.destructive
                                    ? ThemeColors.status.error.solid
                                    : theme[900];

                                return (
                                    <Pressable
                                        key={item.label}
                                        onPress={() => handleSelect(item)}
                                        accessibilityRole="menuitem"
                                        accessibilityLabel={item.label}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 10,
                                            paddingHorizontal: 14,
                                            paddingVertical: 10,
                                            borderBottomWidth: isLast ? 0 : 1,
                                            borderBottomColor: theme[100],
                                        }}
                                    >
                                        {item.icon && (
                                            <item.icon size={16} color={color} />
                                        )}
                                        <ThemedText
                                            type="body-sm"
                                            style={{ color, flex: 1 }}
                                        >
                                            {item.label}
                                        </ThemedText>
                                        {item.selected && (
                                            <Check size={14} color={theme[500]} />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </>
    );
}

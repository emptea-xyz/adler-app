import React, { useState, useRef, useCallback } from "react";
import {
    View,
    Pressable,
    Modal,
    TouchableWithoutFeedback,
} from "react-native";
import { ThemedText } from "@/components/base/ThemedText";
import { useTheme } from "@/contexts/ThemeContext";
import { ChevronDown } from "lucide-react-native";
import { haptic } from "@/lib/utils/haptic";
import { Neutral } from "@/constants/NeutralColors";

interface DropdownOption<T extends string> {
    label: string;
    value: T;
}

interface DropdownProps<T extends string> {
    options: DropdownOption<T>[];
    value: T;
    onChange: (value: T) => void;
}

export function Dropdown<T extends string>({
    options,
    value,
    onChange,
}: DropdownProps<T>) {
    const { theme } = useTheme();
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0 });
    const triggerRef = useRef<View>(null);

    const activeLabel =
        options.find((o) => o.value === value)?.label ?? value;

    const handleOpen = useCallback(() => {
        triggerRef.current?.measureInWindow((x, y, width, height) => {
            setAnchor({ x, y: y + height + 4, width });
            setOpen(true);
        });
        haptic("light");
    }, []);

    const handleSelect = useCallback(
        (v: T) => {
            haptic("light");
            onChange(v);
            setOpen(false);
        },
        [onChange]
    );

    return (
        <>
            <Pressable onPress={handleOpen}>
                <View
                    ref={triggerRef}
                    className="flex-row items-center justify-between rounded-card px-4 py-4"
                    style={{
                        borderWidth: 1,
                        borderColor: theme[100],
                    }}
                >
                    <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
                        {activeLabel}
                    </ThemedText>
                    <ChevronDown size={14} color={theme[400]} />
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
                                top: anchor.y,
                                left: anchor.x,
                                minWidth: Math.max(anchor.width, 120),
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
                            {options.map((option, index) => {
                                const isActive = option.value === value;
                                const isLast = index === options.length - 1;
                                return (
                                    <Pressable
                                        key={option.value}
                                        onPress={() => handleSelect(option.value)}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 10,
                                            backgroundColor: isActive
                                                ? theme[100]
                                                : "transparent",
                                            borderBottomWidth: isLast ? 0 : 1,
                                            borderBottomColor: theme[100],
                                        }}
                                    >
                                        <ThemedText
                                            type="body-sm"
                                            style={{
                                                color: isActive
                                                    ? theme[950]
                                                    : theme[600],
                                            }}
                                        >
                                            {option.label}
                                        </ThemedText>
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

import React, { useCallback } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/base/ThemedText";
import { haptic } from "@/lib/utils/haptic";
import { BottomSheet } from "./BottomSheet";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Props for the Alert component
 */
interface AlertProps {
  /** Controls visibility of the alert modal */
  visible: boolean;
  /** Title text displayed at the top of the alert */
  title: string;
  /** Main message content of the alert */
  message: string;
  /** Callback function when cancel/close is pressed */
  onCancel: () => void;
  /** Callback function when confirm action is pressed */
  onConfirm: () => void;
  /** Text for the confirm button (default: "Confirm") */
  confirmText?: string;
  /** Text for the cancel button (default: "Cancel") */
  cancelText?: string;
  /** Color for the confirm button text (default: theme text color) */
  confirmColor?: string;
  /** Height of the alert (default: 200) */
  height?: number;
  /** Whether the confirm action is destructive (renders red background) */
  isDestructive?: boolean;
}

/**
 * A custom modal alert component styled like BottomSheet.
 * Features a blurred backdrop and customizable actions.
 */
export function Alert({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor,
  height = 200,
  isDestructive = false,
}: AlertProps) {
  const { theme } = useTheme();
  const pendingActionRef = React.useRef<"cancel" | "confirm" | null>(null);

  const handleSheetClose = useCallback(() => {
    const action = pendingActionRef.current ?? "cancel";
    // Reset for next time
    pendingActionRef.current = null;

    if (action === "confirm") {
      onConfirm();
    } else {
      onCancel();
    }
  }, [onCancel, onConfirm]);

  const handleCancel = (close: () => void) => {
    haptic('light');
    pendingActionRef.current = "cancel";
    close();
  };

  const handleConfirm = (close: () => void) => {
    haptic('medium');
    pendingActionRef.current = "confirm";
    close();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleSheetClose}
      height={height}
      title={title}
    >
      {({ close }) => (
        <View className="flex-1 pb-3 items-center justify-end">
          <View className="items-center justify-start flex-1">
            <ThemedText
              type="body-lg"
              className="mb-8 text-center"
              style={{ color: `${theme[900]}B3` }} // 70% opacity
            >
              {message}
            </ThemedText>
          </View>

          <View className="flex-row gap-3 w-full">
            {/* Cancel Button */}
            <Pressable
              onPress={() => handleCancel(close)}
              className="flex-1 py-3 px-4 rounded-card"
              style={{ backgroundColor: theme[200] }}
            >
              <ThemedText
                type="body-lg-semibold"
                className="text-center"
              >
                {cancelText}
              </ThemedText>
            </Pressable>

            {/* Confirm Button */}
            <Pressable
              onPress={() => handleConfirm(close)}
              className="flex-1 py-3 px-4 rounded-card"
              style={{ backgroundColor: isDestructive ? '#DC143C' : theme[950] }}
            >
              <ThemedText
                type="body-lg-semibold"
                className="text-center"
                style={{
                  color: confirmColor ?? theme[50]
                }}
              >
                {confirmText}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

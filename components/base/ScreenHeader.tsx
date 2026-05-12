import React from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ThemedText } from "@/components/base/ThemedText";
import { useTheme } from "@/contexts/ThemeContext";
import { haptic } from "@/lib/utils/haptic";

// Figma node 124:122 — compact 48pt header. Back button on the left, title
// left-aligned next to it, optional action buttons on the right.

interface ScreenHeaderAction {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  showBackButton?: boolean;
  actionButton?: ScreenHeaderAction;
  secondaryActionButton?: ScreenHeaderAction;
  leftActionButton?: ScreenHeaderAction;
}

const SLOT = 44;
const ICON = 22;

export function ScreenHeader({
  title,
  onBack,
  showBackButton = true,
  actionButton,
  secondaryActionButton,
  leftActionButton,
}: ScreenHeaderProps) {
  const { theme } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    haptic("light");
    router.back();
  };

  const renderLeft = () => {
    if (showBackButton) {
      return (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="back-button"
          style={{
            width: SLOT,
            height: SLOT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="chevron.left" size={ICON} color={theme[950]} />
        </Pressable>
      );
    }
    if (leftActionButton) {
      return (
        <Pressable
          onPress={() => {
            haptic("light");
            leftActionButton.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={leftActionButton.accessibilityLabel}
          style={{
            width: SLOT,
            height: SLOT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={leftActionButton.icon} size={ICON} color={theme[950]} />
        </Pressable>
      );
    }
    return null;
  };

  const renderActionButton = (action: ScreenHeaderAction) => {
    return (
      <Pressable
        key={action.testID ?? action.accessibilityLabel ?? Math.random().toString()}
        onPress={() => {
          haptic("light");
          action.onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel}
        testID={action.testID}
        style={{
          width: SLOT,
          height: SLOT,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={action.icon} size={ICON} color={theme[950]} />
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 48,
        paddingHorizontal: 12,
      }}
    >
      {renderLeft()}
      <ThemedText
        type="body-xl-semibold"
        style={{ color: theme[950], flex: 1 }}
        numberOfLines={1}
      >
        {title}
      </ThemedText>
      {secondaryActionButton ? renderActionButton(secondaryActionButton) : null}
      {actionButton ? renderActionButton(actionButton) : null}
    </View>
  );
}

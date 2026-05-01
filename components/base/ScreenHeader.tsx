import React from "react";
import { View, Pressable } from 'react-native';
import { router } from "expo-router";
import { haptic } from "@/lib/utils/haptic";
import { ArrowLeftIcon } from "lucide-react-native";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/contexts/ThemeContext";

interface ScreenHeaderAction {
  /** Icon component to render inside the action button */
  icon: React.ComponentType<{ size?: number; color?: string }>;
  /** Callback invoked when the action button is pressed */
  onPress: () => void;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Test ID for automation */
  testID?: string;
}

interface ScreenHeaderProps {
  /** The title to display in the header */
  title: string;
  /** Optional custom back handler */
  onBack?: () => void;
  /** Whether to show the back button */
  showBackButton?: boolean;
  /** Optional action button displayed on the right */
  actionButton?: ScreenHeaderAction;
  /** Optional second action button displayed on the right */
  secondaryActionButton?: ScreenHeaderAction;
  /** Optional action button displayed on the left (replaces back button if showBackButton is false) */
  leftActionButton?: ScreenHeaderAction;
}

export function ScreenHeader({
  title,
  onBack,
  showBackButton = false,
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

    haptic('light');
    router.back();
  };

  const renderBackButton = () => {
    if (showBackButton) {
      return (
        <Pressable
          onPress={handleBack}
          className="w-10 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="back-button"
        >
          <ArrowLeftIcon size={24} color={theme[950]} />
        </Pressable>
      );
    }

    if (leftActionButton) {
      const IconComponent = leftActionButton.icon;
      return (
        <Pressable
          onPress={() => {
            haptic('light');
            leftActionButton.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={leftActionButton.accessibilityLabel}
          className="w-10 h-10 rounded-card items-center justify-center active:opacity-70"
        >
          <IconComponent size={24} color={theme[950]} />
        </Pressable>
      );
    }

    return <View className="w-10" />;
  };

  const renderActionButton = () => {
    if (!actionButton) return <View className="w-10" />;
    const IconComponent = actionButton.icon;
    return (
      <Pressable
        onPress={() => {
          haptic('light');
          actionButton.onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={actionButton.accessibilityLabel}
        testID={actionButton.testID}
        className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
      >
        <IconComponent size={24} color={theme[950]} />
      </Pressable>
    );
  };

  return (
    <View>
      <View className="flex-row items-center justify-between p-4 pb-0 gap-2 relative h-28">
        <View className="z-10 bg-transparent flex-row items-center">
          {renderBackButton()}
        </View>

        <View
          pointerEvents="none"
          className="absolute left-0 right-0 top-0 bottom-0 items-center justify-center pt-4"
        >
          <ThemedText type="h4" className="text-center px-14">
            {title}
          </ThemedText>
        </View>

        <View className="flex-row items-center gap-1 z-10 bg-transparent">
          {secondaryActionButton && (
            <Pressable
              onPress={() => {
                haptic('light');
                secondaryActionButton.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={secondaryActionButton.accessibilityLabel}
              className="w-10 h-10 rounded-card items-center justify-center active:opacity-70"
            >
              <secondaryActionButton.icon size={24} color={theme[950]} />
            </Pressable>
          )}
          {renderActionButton()}
        </View>
      </View>
    </View>
  );
}

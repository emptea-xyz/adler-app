import { Pressable, PressableProps, View, StyleProp, TextStyle, ActivityIndicator, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { cn } from "@/lib/utils/cn";
import React from "react";

import { ThemedText } from "@/components/base/ThemedText";
import { haptic } from "@/lib/utils/haptic";
import { useTheme } from "@/contexts/ThemeContext";
import { DESTRUCTIVE } from "@/constants/StatusColors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);


type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'inline' | 'destructive';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

/**
 * Props for the Button component.
 */
type ButtonProps = Omit<PressableProps, 'children'> & {
  /** Custom content (overrides title) */
  children?: React.ReactNode;
  /** Text to display on the button */
  title?: string;
  /** Callback when button is pressed */
  onPress?: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether to show a loading spinner */
  loading?: boolean;
  /** Visual variant of the button */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Optional icon component to show on the left */
  leftIcon?: React.ReactNode;
  /** Optional icon component to show on the right */
  rightIcon?: React.ReactNode;
  /** Custom CSS class string for the button container */
  className?: string;
  /** Custom CSS class string for the text */
  textClassName?: string;
  /** Custom style object for the text */
  textStyle?: StyleProp<TextStyle>;
};

/**
 * Simple button component with loading states and icons.
 * Includes haptic feedback on press.
 */
export const Button = React.memo(({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'default',
  leftIcon,
  rightIcon,
  className,
  textClassName,
  textStyle,
  children,
  ...rest
}: ButtonProps) => {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;
  const isIconOnly = !title && !children;

  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const variants: Record<ButtonVariant, { bg: StyleProp<ViewStyle>; text: string }> = {
    primary: { bg: { backgroundColor: theme[950] }, text: theme[50] },
    secondary: { bg: { backgroundColor: theme[100] }, text: theme[950] },
    tertiary: { bg: { backgroundColor: theme[200] }, text: theme[950] },
    inline: { bg: { backgroundColor: 'transparent' }, text: theme[950] },
    destructive: { bg: { backgroundColor: DESTRUCTIVE }, text: theme[50] },
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "h-10 px-3",
    default: "h-12 px-4",
    lg: "h-14 px-6",
    icon: "h-12 aspect-square",
  };

  const handlePress = () => {
    if (isDisabled) return;
    haptic('light');
    onPress?.();
  };

  const { bg, text: textColor } = variants[variant];

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => { scale.value = withTiming(0.95, { duration: 100, easing: Easing.out(Easing.quad) }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }); }}
      className={cn(
        "flex-row items-center justify-center rounded-button",
        sizes[size],
        isIconOnly && "aspect-square",
        isDisabled && "opacity-50",
        className
      )}
      style={[bg, scaleStyle, rest.style as StyleProp<ViewStyle>]}
      disabled={isDisabled}
      {...rest}
    >

      {loading && (
        <View className="mr-2">
          <ActivityIndicator color={textColor} size="small" />
        </View>
      )}

      {!loading && leftIcon && <View className={title ? "mr-2" : ""}>{leftIcon}</View>}

      {children ? children : title && (
        <ThemedText
          type={size === 'sm' ? 'body-sm-semibold' : 'body-lg-semibold'}
          style={[
            { color: textColor },
            textStyle,
          ]}
        >
          {title}
        </ThemedText>
      )}

      {!loading && rightIcon && <View className={title ? "ml-2" : ""}>{rightIcon}</View>}
    </AnimatedPressable>
  );
});

Button.displayName = 'Button';
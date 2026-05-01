import React from 'react';
import { View, Pressable, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { cn } from '@/components/utils/cn';
import { useTheme } from '@/contexts/ThemeContext';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type CardVariant = 'outline' | 'filled' | 'borderless' | 'border-top' | 'border-bottom' | 'border-y';

interface CardBaseProps {
  /**
   * Visual style variant
   * - outline: transparent bg, 1px theme[100] border, rounded-card
   * - filled: theme[100] bg, no border, rounded-card
   * - borderless: transparent bg, no border, no rounding
   * - border-top: transparent bg, 1px top border, pt-3 only, no rounding
   * - border-bottom: transparent bg, 1px bottom border, pb-3 only, no rounding
   * - border-y: transparent bg, 1px top + bottom border, py-3, no rounding
   */
  variant?: CardVariant;
  /** Custom CSS class string */
  className?: string;
  /** Whether to use Animated components */
  animated?: boolean;
  children?: React.ReactNode;
  /** Press handler — when provided, Card renders as a Pressable */
  onPress?: () => void;
  /** Style override */
  style?: StyleProp<ViewStyle>;
}

type CardProps = CardBaseProps & Omit<ViewProps, 'style'> & Partial<AnimatedProps<ViewProps>>;

/**
 * Standard Card component with grid-aesthetic design language.
 * Thin 1px borders, transparent backgrounds, subtle 6px rounding.
 */
export default function Card({
  variant = 'outline',
  className,
  style,
  onPress,
  animated = false,
  children,
  ...rest
}: CardProps) {
  const { theme } = useTheme();

  const variantClassName: Record<CardVariant, string> = {
    'outline': "p-3 rounded-card",
    'filled': "p-3 rounded-card",
    'borderless': "",
    'border-top': "pt-3",
    'border-bottom': "pb-3",
    'border-y': "py-3",
  };

  const variantStyle: Record<CardVariant, ViewStyle> = {
    'outline': { borderWidth: 1, borderColor: theme[100] },
    'filled': { backgroundColor: theme[100] },
    'borderless': {},
    'border-top': { borderTopWidth: 1, borderTopColor: theme[100] },
    'border-bottom': { borderBottomWidth: 1, borderBottomColor: theme[100] },
    'border-y': { borderTopWidth: 1, borderTopColor: theme[100], borderBottomWidth: 1, borderBottomColor: theme[100] },
  };

  const baseClassName = cn(variantClassName[variant], className);
  const baseStyle: StyleProp<ViewStyle> = [variantStyle[variant], style];

  if (animated) {
    if (onPress) {
      return (
        <AnimatedPressable
          onPress={onPress}
          className={baseClassName}
          style={baseStyle}
          {...rest}
        >
          {children}
        </AnimatedPressable>
      );
    }
    return (
      <AnimatedView
        className={baseClassName}
        style={baseStyle}
        {...rest}
      >
        {children}
      </AnimatedView>
    );
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={baseClassName}
        style={baseStyle}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      className={baseClassName}
      style={baseStyle}
      {...rest}
    >
      {children}
    </View>
  );
}

import React, { useEffect } from 'react';
import { DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { cn } from '@/components/utils/cn';
import { BORDER_RADIUS } from '@/constants/ComponentTheme';
import { AnimationDuration } from '@/constants/LayoutConstants';
import { useTheme } from '@/contexts/ThemeContext';

interface SkeletonProps {
  /** Width of skeleton */
  width?: DimensionValue;
  /** Height of skeleton */
  height?: DimensionValue;
  /** Shape variant */
  variant?: 'rectangle' | 'circle' | 'text';
  /** Whether to animate */
  animate?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Skeleton Component
 * 
 * Loading placeholder with pulse animation (Reanimated for native thread performance).
 */
export function Skeleton({
  width,
  height,
  variant = 'rectangle',
  animate = true,
  className,
}: SkeletonProps) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (animate) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: AnimationDuration.pulse, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: AnimationDuration.pulse, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite repeat
        false
      );
    } else {
      opacity.value = 0.5;
    }
  }, [animate, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const getBorderRadius = () => {
    if (variant === 'circle') return 'rounded-full';
    if (variant === 'text') return BORDER_RADIUS.sm;
    return BORDER_RADIUS.md;
  };

  // Only inject dimension styles from explicit props; fall back to defaults only
  // when no className is provided (so className-based sizing like flex-1/h-20 isn't overridden)
  const getDimensionStyle = (): { width?: DimensionValue; height?: DimensionValue } => {
    const hasExplicitDims = width !== undefined || height !== undefined;
    if (hasExplicitDims) {
      return {
        width: width ?? (variant === 'circle' ? 40 : '100%'),
        height: height ?? (variant === 'circle' ? 40 : variant === 'text' ? 20 : 100),
      };
    }
    // No explicit props — let className control layout; only apply defaults if no className
    if (!className) {
      if (variant === 'circle') return { width: 40, height: 40 };
      if (variant === 'text') return { width: '100%', height: 20 };
      return { width: '100%', height: 100 };
    }
    return {};
  };

  return (
    <Animated.View
      style={[animatedStyle, getDimensionStyle(), { backgroundColor: theme[500] }]}
      className={cn(
        getBorderRadius(),
        className
      )}
    />
  );
}

/**
 * SkeletonCard - Card-shaped skeleton for list items
 */
export function SkeletonCard({ className }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <Animated.View className={cn("rounded-2xl p-4 mb-3", className)} style={{ backgroundColor: theme[500] }}>
      <Skeleton variant="text" width="60%" height={18} className="mb-2" />
      <Skeleton variant="text" width="40%" height={14} className="mb-3" />
      <Skeleton variant="rectangle" height={12} width="80%" />
    </Animated.View>
  );
}

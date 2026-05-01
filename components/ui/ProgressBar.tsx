/**
 * Universal Skia-based progress bar with gradient fill and inner shadows.
 *
 * Usage:
 *   <ProgressBar progress={0.6} colors={signalColors.lp} />
 *   <ProgressBar progress={0.3} colors={signalColors.mp} height={10} />
 */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Canvas,
  RoundedRect,
  Shadow,
  LinearGradient,
  vec,
} from "@shopify/react-native-skia";
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemePalette } from "@/constants/ThemePalettes";

interface ProgressBarProps {
  /** Progress value between 0 and 1 */
  progress: number;
  /** Color palette with 400/500/600 keys (e.g. signalColors.lp) */
  colors: ThemePalette;
  /** Bar height in pixels (default: 14) */
  height?: number;
  /** Background color override (defaults to theme[100]) */
  bgColor?: string;
  /** Animation duration in ms (default: 1000, set to 0 to disable) */
  animationDuration?: number;
}

export const ProgressBar = React.memo(
  ({
    progress,
    colors,
    height = 14,
    bgColor,
    animationDuration = 1000,
  }: ProgressBarProps) => {
    const { theme } = useTheme();
    const [containerWidth, setContainerWidth] = useState(0);

    const animatedProgress = useSharedValue(0);

    useEffect(() => {
      const clampedProgress = Math.min(Math.max(progress, 0), 1);
      if (animationDuration > 0) {
        animatedProgress.value = withTiming(clampedProgress, {
          duration: animationDuration,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        animatedProgress.value = clampedProgress;
      }
    }, [progress, animationDuration, animatedProgress]);

    const barWidth = useDerivedValue(() => {
      return containerWidth * animatedProgress.value;
    });

    const background = bgColor ?? theme[200];

    return (
      <View
        style={{ height, width: "100%" }}
        className="rounded-full overflow-hidden"
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && (
          <Canvas style={{ flex: 1 }} pointerEvents="none">
            {/* Background */}
            <RoundedRect
              x={0}
              y={0}
              width={containerWidth}
              height={height}
              r={100}
              color={background}
            />

            {/* Progress Fill */}
            <RoundedRect
              x={0}
              y={0}
              width={barWidth}
              height={height}
              r={100}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(containerWidth, 0)}
                colors={[colors[400], colors[500], colors[600]]}
              />
              <Shadow
                dx={0}
                dy={0}
                blur={4}
                color="rgba(255,255,255,0.5)"
                inner
              />
              <Shadow
                dx={0}
                dy={0}
                blur={1}
                color="rgba(0,0,0,0.4)"
                inner
              />
            </RoundedRect>
          </Canvas>
        )}
      </View>
    );
  },
);

ProgressBar.displayName = "ProgressBar";

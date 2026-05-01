/**
 * Shared gesture hook for chart touch interactions.
 * Maps horizontal pan position to a data index.
 */
import { useState, useCallback } from "react";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue, useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { haptic } from "@/lib/utils/haptic";
import { CHART_TOKENS } from "../tokens";

interface UseChartGestureOptions {
  /** Total number of data points */
  dataLength: number;
  /** Left edge of chart area (px) */
  paddingLeft: number;
  /** Width of chart area (px) */
  chartWidth: number;
  /** Whether to snap to nearest bar (discrete) vs nearest point (continuous) */
  mode?: "discrete" | "continuous";
  /** Step width for discrete mode (bar width + gap) */
  stepWidth?: number;
}

export function useChartGesture({
  dataLength,
  paddingLeft,
  chartWidth,
  mode = "continuous",
  stepWidth,
}: UseChartGestureOptions) {
  const touchX = useSharedValue(-1);
  const isActive = useSharedValue(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const lastHapticIndex = useSharedValue(-1);

  const triggerHaptic = useCallback(() => {
    haptic(CHART_TOKENS.touch.hapticMove);
  }, []);

  const triggerStartHaptic = useCallback(() => {
    haptic(CHART_TOKENS.touch.hapticStart);
  }, []);

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      touchX.value = e.x;
      isActive.value = true;
      runOnJS(triggerStartHaptic)();
    })
    .onUpdate((e) => {
      touchX.value = e.x;
    })
    .onEnd(() => {
      isActive.value = false;
      touchX.value = -1;
      lastHapticIndex.value = -1;
    });

  useAnimatedReaction(
    () => ({ x: touchX.value, active: isActive.value }),
    (current) => {
      if (current.active && dataLength > 0) {
        const x = current.x - paddingLeft;
        let idx: number;
        if (mode === "discrete" && stepWidth) {
          idx = Math.floor(x / stepWidth);
        } else {
          const step = chartWidth / (dataLength - 1 || 1);
          idx = Math.round(x / step);
        }
        const clampedIdx = Math.max(0, Math.min(dataLength - 1, idx));
        runOnJS(setActiveIndex)(clampedIdx);

        if (clampedIdx !== lastHapticIndex.value) {
          lastHapticIndex.value = clampedIdx;
          runOnJS(triggerHaptic)();
        }
      } else {
        runOnJS(setActiveIndex)(-1);
      }
    },
    [dataLength, chartWidth, paddingLeft, mode, stepWidth],
  );

  return { gesture, activeIndex, isActive };
}

import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { ACCENT_COLORS } from '@/constants/ThemePalettes';

// Figma node 119:132 — loader spinner. Cyan arc rotating around a soft track,
// driven by Reanimated. ViewBox 234 × 237.209; we approximate as 230 square.

interface LoaderProps {
  size?: number;
}

const STROKE = 14;

export function Loader({ size = 230 }: LoaderProps) {
  const { theme } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const center = size / 2;
  const radius = size / 2 - STROKE;

  // Pre-build the partial-arc path (~75% of the circle).
  const arcPath = useMemo(() => {
    const p = Skia.Path.Make();
    const rect = {
      x: center - radius,
      y: center - radius,
      width: radius * 2,
      height: radius * 2,
    };
    p.addArc(rect, -90, 270);
    return p;
  }, [center, radius]);

  const transform = useDerivedValue(() => [{ rotate: rotation.value }]);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ flex: 1 }}>
        {/* Track ring */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          color={theme[100]}
          style="stroke"
          strokeWidth={STROKE}
        />
        {/* Animated arc — cyan accent */}
        <Group origin={{ x: center, y: center }} transform={transform}>
          <Path
            path={arcPath}
            style="stroke"
            strokeWidth={STROKE}
            strokeCap="round"
            color={ACCENT_COLORS.cyan}
          />
        </Group>
      </Canvas>
    </View>
  );
}

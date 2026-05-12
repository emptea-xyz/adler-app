import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Path, Skia, vec } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

interface SpinnerProps {
  size?: number;
  strokeWidth?: number;
  duration?: number;
  color?: string;
  trackColor?: string;
}

// Conventional indeterminate circular spinner. A 270° arc rotates continuously
// over a faint full-circle track. Skia-backed so it stays smooth under JS load.
export function Spinner({
  size = 48,
  strokeWidth,
  duration = 900,
  color,
  trackColor,
}: SpinnerProps) {
  const { theme } = useTheme();
  const stroke = strokeWidth ?? Math.max(2, Math.round(size / 12));
  const arcColor = color ?? theme[950];
  const track = trackColor ?? theme[200];

  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const arcPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const rect = Skia.XYWHRect(cx - radius, cy - radius, radius * 2, radius * 2);
    p.addArc(rect, -90, 270);
    return p;
  }, [cx, cy, radius]);

  const trackPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(cx, cy, radius);
    return p;
  }, [cx, cy, radius]);

  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation, duration]);

  const transform = useDerivedValue(() => [{ rotate: rotation.value * 2 * Math.PI }]);
  const origin = useDerivedValue(() => vec(cx, cy));

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        <Path
          path={trackPath}
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
          color={track}
        />
        <Group transform={transform} origin={origin}>
          <Path
            path={arcPath}
            style="stroke"
            strokeWidth={stroke}
            strokeCap="round"
            color={arcColor}
          />
        </Group>
      </Canvas>
    </View>
  );
}

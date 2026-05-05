import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import {
  Easing,
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ACCENT_COLORS } from '@/constants/ThemePalettes';
import { A, D, EAGLE_VIEWBOX } from './EagleLoader.paths';

// Animated Adler eagle. The silhouette stays #FAFAFA; the accent layer cycles
// through ACCENT_COLORS — pink → cyan → lime → orange → pink — driven by a
// single Reanimated shared value that loops every `duration` ms.
//
// Path data is sourced from assets/images/eagle-compact.svg (visually
// identical to eagle-original.svg, 911 paths in document order). Each path's
// fill is encoded in the bit string `A`: '1' = accent, '0' = silhouette.

const SILHOUETTE_COLOR = '#fafafa';

const CYCLE_COLORS = [
  ACCENT_COLORS.pink,
  ACCENT_COLORS.cyan,
  ACCENT_COLORS.lime,
  ACCENT_COLORS.orange,
];

const CYCLE_STOPS = [0, 0.25, 0.5, 0.75, 1];
const CYCLE_OUTPUT = [...CYCLE_COLORS, CYCLE_COLORS[0]]; // wrap back to first

interface EagleLoaderProps {
  /** Rendered height in dp; width follows the 133:171 aspect ratio. */
  size?: number;
  /** Full color cycle duration in ms. */
  duration?: number;
}

export function EagleLoader({ size = 100, duration = 4000 }: EagleLoaderProps) {
  const aspect = EAGLE_VIEWBOX.width / EAGLE_VIEWBOX.height;
  const width = size * aspect;
  const scale = size / EAGLE_VIEWBOX.height;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress, duration]);

  const accentColor = useDerivedValue(() => {
    const c = interpolateColor(progress.value, CYCLE_STOPS, CYCLE_OUTPUT);
    return Skia.Color(c as unknown as string);
  });

  // Pre-parse path strings to Skia paths once; avoids re-parsing on every
  // accent-color update (color flows through Skia via the shared value, not
  // React re-renders, but parsed paths are still cheaper to keep).
  const parsed = useMemo(
    () => D.map((d) => Skia.Path.MakeFromSVGString(d)).filter((p): p is NonNullable<typeof p> => p !== null),
    [],
  );

  return (
    <View style={{ width, height: size }}>
      <Canvas style={{ flex: 1 }}>
        <Group transform={[{ scale }]}>
          {parsed.map((p, i) => (
            <Path
              key={i}
              path={p}
              color={A[i] === '1' ? accentColor : SILHOUETTE_COLOR}
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

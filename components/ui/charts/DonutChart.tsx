/**
 * DonutChart - Skia-based donut/ring chart.
 *
 * Features:
 * - Max 5 visible segments + "Other" bucket
 * - Legend below chart
 * - Optional center label/value
 * - Theme-aware colors
 */
import React, { useMemo } from "react";
import { View } from "react-native";
import { Skia, Path, Canvas } from "@shopify/react-native-skia";
import { ThemedText } from "@/components/base/ThemedText";
import { useTheme } from "@/contexts/ThemeContext";

interface DonutSegment {
  label: string;
  value: number;
}

interface ProcessedSegment extends DonutSegment {
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  maxSegments?: number;
  centerLabel?: string;
  centerValue?: string;
  showLegend?: boolean;
  /**
   * Optional palette for segments. Defaults to a descending ramp of the
   * brand-accent shades (signalColors.accent 700→300) so segment ranking is
   * encoded in the shade.
   */
  colors?: string[];
}

export function DonutChart({
  data,
  size = 180,
  thickness = 28,
  maxSegments = 5,
  centerLabel,
  centerValue,
  showLegend = true,
  colors,
}: DonutChartProps) {
  const { theme, signalColors } = useTheme();

  const palette = useMemo(
    () =>
      colors ?? [
        signalColors.accent[700],
        signalColors.accent[600],
        signalColors.accent[500],
        signalColors.accent[400],
        signalColors.accent[300],
      ],
    [colors, signalColors],
  );

  const segments = useMemo<ProcessedSegment[]>(() => {
    if (data.length === 0) return [];

    const sorted = [...data].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, maxSegments);
    const rest = sorted.slice(maxSegments);
    const otherValue = rest.reduce((sum, d) => sum + d.value, 0);

    const result: ProcessedSegment[] = top.map((d, i) => ({
      ...d,
      color: palette[i % palette.length],
    }));

    if (otherValue > 0) {
      result.push({ label: "Other", value: otherValue, color: theme[400] });
    }

    return result;
  }, [data, maxSegments, theme, palette]);

  const total = useMemo(
    () => segments.reduce((sum, s) => sum + s.value, 0),
    [segments],
  );

  const arcs = useMemo(() => {
    if (total === 0 || segments.length === 0) return [];

    const cx = size / 2;
    const cy = size / 2;
    const r = (size - thickness) / 2;
    const gap = segments.length > 1 ? 3 : 0;
    const totalGap = gap * segments.length;
    const availableDeg = 360 - totalGap;

    let angle = -90;

    return segments.map((seg) => {
      const sweep = (seg.value / total) * availableDeg;
      const p = Skia.Path.Make();
      p.addArc(
        { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r },
        angle,
        sweep,
      );
      const result = { path: p, color: seg.color };
      angle += sweep + gap;
      return result;
    });
  }, [segments, total, size, thickness]);

  const emptyRingPath = useMemo(() => {
    if (data.length > 0) return null;
    const cx = size / 2;
    const cy = size / 2;
    const r = (size - thickness) / 2;
    const p = Skia.Path.Make();
    p.addArc(
      { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r },
      -90,
      359.99,
    );
    return p;
  }, [data.length, size, thickness]);

  return (
    <View className="items-center">
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          {emptyRingPath ? (
            <Path
              path={emptyRingPath}
              style="stroke"
              strokeWidth={thickness}
              color={theme[200]}
              strokeCap="butt"
            />
          ) : (
            arcs.map((arc, i) => (
              <Path
                key={i}
                path={arc.path}
                style="stroke"
                strokeWidth={thickness}
                color={arc.color}
                strokeCap="butt"
              />
            ))
          )}
        </Canvas>

        {(centerLabel || centerValue) && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
            pointerEvents="none"
          >
            {centerValue && (
              <ThemedText type="h3" style={{ color: theme[950] }}>
                {centerValue}
              </ThemedText>
            )}
            {centerLabel && (
              <ThemedText type="body-xs" style={{ color: theme[400] }}>
                {centerLabel}
              </ThemedText>
            )}
          </View>
        )}
      </View>

      {/* Legend below chart */}
      {showLegend && (
        <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
          {segments.map((seg, i) => (
            <View key={i} className="flex-row items-center gap-1.5">
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: seg.color,
                }}
              />
              <ThemedText type="caption" style={{ color: theme[600] }}>
                {seg.label}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme[400] }}>
                {Math.round((seg.value / total) * 100)}%
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

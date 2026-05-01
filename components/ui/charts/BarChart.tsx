/**
 * BarChart - Unified bar chart supporting single, dual, and per-bar-color modes.
 * Replaces legacy SkiaBarChart and per-bar-color chart variants.
 *
 * Modes:
 * - Default: single-color bars with header + touch
 * - `perBarColors`: each bar has its own color (comparison charts)
 * - `showSecondary`: dual bars side-by-side (LP+MP)
 * - `preview`: compact, non-interactive, no header
 */
import React, { useCallback, useMemo } from "react";
import { View } from "react-native";
import { BarChart2 as BarChart2Icon } from "lucide-react-native";
import {
  Path,
  vec,
  useFont,
  Text as SkiaText,
  Line as SkiaLine,
} from "@shopify/react-native-skia";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemedText } from "@/components/base/ThemedText";
import { CHART_TOKENS, CHART_CANVAS_WIDTH } from "./tokens";
import { ChartCanvas } from "./primitives/ChartCanvas";
import { ChartHeader } from "./primitives/ChartHeader";
import { YAxis } from "./primitives/YAxis";
import { useChartGesture } from "./hooks/useChartGesture";
import { makeTopRoundedBarPath } from "./utils/barPath";
import { generateChartNarrative } from "@/lib/utils/chartNarrative";

interface BarChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  activeLabel?: string;
  /** Per-bar color (used in comparison charts) */
  color?: string;
}

interface BarChartProps {
  data: BarChartDataPoint[];
  color?: string;
  secondaryColor?: string;
  height?: number;
  title?: string;
  unit?: string;
  secondaryUnit?: string;
  showSecondary?: boolean;
  formatValue?: (value: number) => string;
  /** Show Y-axis grid + labels */
  showAxes?: boolean;
  /** Show X-axis labels on each bar */
  showXLabels?: boolean;
  /** Max characters for X labels */
  maxXLabelChars?: number;
  /** Compact non-interactive preview mode */
  preview?: boolean;
  /** Custom header renderer (for comparison bar chart with avatars) */
  renderHeader?: (activeIndex: number, data: BarChartDataPoint[]) => React.ReactNode;
  /** Range label for default header (e.g. "30 days") */
  rangeDays?: number;
  showChevron?: boolean;
}

export function BarChart({
  data,
  color: colorProp,
  secondaryColor: secondaryColorProp,
  height = 200,
  title = "Chart",
  unit = "",
  secondaryUnit = "",
  showSecondary = false,
  formatValue = (v) => v.toLocaleString(),
  showAxes = false,
  showXLabels = false,
  maxXLabelChars,
  preview = false,
  renderHeader,
  rangeDays,
  showChevron,
}: BarChartProps) {
  const { theme } = useTheme();
  const color = colorProp ?? theme[500];
  const secondaryColor = secondaryColorProp ?? theme[300];
  const hasPerBarColors = data.some((d) => d.color);

  const canvasWidth = CHART_CANVAS_WIDTH;
  const padding = preview
    ? CHART_TOKENS.padding.preview
    : showAxes
      ? CHART_TOKENS.padding.withAxes
      : { top: 8, right: 4, bottom: showXLabels ? 24 : 0, left: showXLabels ? 4 : 4 };
  const chartWidth = canvasWidth - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Values for scale
  const allValues = useMemo(
    () =>
      data.flatMap((d) =>
        showSecondary && d.secondaryValue !== undefined
          ? [d.value, d.secondaryValue]
          : [d.value],
      ),
    [data, showSecondary],
  );
  const maxValue = useMemo(
    () => (allValues.length > 0 ? Math.max(...allValues, 1) : 100),
    [allValues],
  );

  // Bar dimensions
  const barGap = preview ? 4 : showAxes ? 6 : 2;
  const groupWidth =
    data.length > 0
      ? (chartWidth - barGap * (data.length - 1)) / data.length
      : 20;
  const barWidthRaw = showSecondary ? (groupWidth - 4) / 2 : groupWidth;
  const barWidth = showAxes
    ? Math.max(16, Math.min(40, barWidthRaw))
    : barWidthRaw;
  const barRadius = CHART_TOKENS.stroke.barRadius(barWidth);
  const barOffsetX = padding.left + (showAxes ? 2 : 0);

  const maxBarHeight = showAxes ? chartHeight * 0.85 : chartHeight;
  const minBarHeight = showAxes ? 6 : 4;

  const getBarHeight = useCallback(
    (value: number) => {
      const scaled = (value / maxValue) * maxBarHeight;
      return Math.max(minBarHeight, Math.min(maxBarHeight, scaled));
    },
    [maxValue, maxBarHeight, minBarHeight],
  );

  const getBarX = useCallback(
    (index: number, isSecondary = false) => {
      const step = showAxes
        ? barWidth + barGap
        : (showSecondary ? groupWidth + barGap : barWidth + barGap);
      const gx = barOffsetX + index * step;
      if (showSecondary) {
        return isSecondary ? gx + barWidth + 4 : gx;
      }
      return gx;
    },
    [barOffsetX, barWidth, barGap, showSecondary, showAxes, groupWidth],
  );

  // Gesture
  const stepWidth = showAxes ? barWidth + barGap : (showSecondary ? groupWidth + barGap : barWidth + barGap);
  const { gesture, activeIndex } = useChartGesture({
    dataLength: data.length,
    paddingLeft: barOffsetX,
    chartWidth,
    mode: "discrete",
    stepWidth,
  });

  // Font for X labels
  const font = useFont(
    CHART_TOKENS.font.require,
    preview ? 8 : CHART_TOKENS.font.axisSize,
  );

  const activePoint =
    activeIndex >= 0 && activeIndex < data.length ? data[activeIndex] : null;
  const totalValue = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  const narrative = useMemo(
    () =>
      generateChartNarrative({
        title,
        values: data.map((d) => d.value),
        unit,
        rangeLabel: rangeDays ? `${rangeDays} days` : undefined,
      }),
    [data, title, unit, rangeDays],
  );

  if (data.length === 0) {
    return (
      <View className="w-full p-4 items-center justify-center gap-2" style={{ height }}>
        <BarChart2Icon size={28} color={CHART_TOKENS.colors.emptyState(theme)} />
        <ThemedText type="body-sm" style={{ color: CHART_TOKENS.colors.emptyState(theme) }}>
          No data yet
        </ThemedText>
      </View>
    );
  }

  return (
    <View accessibilityRole="image" accessibilityLabel={narrative}>
      {/* Header */}
      {!preview && (
        renderHeader ? (
          renderHeader(activeIndex, data)
        ) : (
          <ChartHeader
            title={title}
            value={activePoint ? activePoint.value : totalValue}
            unit={unit}
            label={activePoint ? (activePoint.activeLabel ?? activePoint.label) : (rangeDays ? `Last ${rangeDays} days` : "Total")}
            color={hasPerBarColors
              ? (activePoint?.color ?? color)
              : activePoint
                ? color
                : theme[950]}
            formatValue={formatValue}
            showChevron={showChevron}
          />
        )
      )}

      {/* Chart */}
      <ChartCanvas
        width={canvasWidth}
        height={height}
        gesture={preview ? undefined : gesture}
      >
        {/* Y-axis grid */}
        {showAxes && (
          <YAxis
            min={0}
            max={maxValue}
            chartWidth={chartWidth}
            chartHeight={chartHeight}
            paddingTop={padding.top}
            paddingLeft={padding.left}
            gridLineColor={CHART_TOKENS.colors.gridLine(theme)}
            labelColor={CHART_TOKENS.colors.axisLabel(theme)}
          />
        )}

        {/* Baseline */}
        {showAxes && (
          <SkiaLine
            p1={vec(padding.left, padding.top + chartHeight)}
            p2={vec(padding.left + chartWidth, padding.top + chartHeight)}
            color={CHART_TOKENS.colors.baseline(theme)}
            strokeWidth={CHART_TOKENS.stroke.baseline}
            style="stroke"
          />
        )}

        {/* Bars */}
        {data.map((point, i) => {
          const barH = getBarHeight(point.value);
          const isActiveBar = activeIndex === i;
          const opacity =
            preview || activeIndex === -1 ? 1 : isActiveBar ? 1 : 0.3;
          const bx = getBarX(i);
          const by = padding.top + chartHeight - barH;
          const barColor = hasPerBarColors
            ? (point.color ?? color)
            : color;

          return (
            <Path
              key={`primary-${i}`}
              path={makeTopRoundedBarPath(bx, by, barWidth, barH, barRadius)}
              color={barColor}
              opacity={opacity}
            />
          );
        })}

        {/* Secondary bars */}
        {showSecondary &&
          data.map((point, i) => {
            if (point.secondaryValue === undefined) return null;
            const barH = getBarHeight(point.secondaryValue);
            const isActiveBar = activeIndex === i;
            const opacity = activeIndex === -1 ? 1 : isActiveBar ? 1 : 0.3;
            const bx = getBarX(i, true);
            const by = padding.top + chartHeight - barH;

            return (
              <Path
                key={`secondary-${i}`}
                path={makeTopRoundedBarPath(bx, by, barWidth, barH, barRadius)}
                color={secondaryColor}
                opacity={opacity}
              />
            );
          })}

        {/* X-axis labels */}
        {showXLabels &&
          font &&
          data.map((point, i) => {
            let text = point.label;
            if (!text) return null;
            if (maxXLabelChars && text.length > maxXLabelChars) {
              text = text.slice(0, maxXLabelChars);
            }
            const textWidth = font.measureText(text).width;
            const bx = getBarX(i);
            return (
              <SkiaText
                key={`x-label-${i}`}
                x={bx + barWidth / 2 - textWidth / 2}
                y={padding.top + chartHeight + (preview ? 11 : 14)}
                text={text}
                font={font}
                color={CHART_TOKENS.colors.axisLabel(theme)}
              />
            );
          })}
      </ChartCanvas>
    </View>
  );
}

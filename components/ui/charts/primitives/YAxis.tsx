/**
 * YAxis - Renders horizontal grid lines and left-aligned Y-axis labels.
 */
import React from "react";
import {
  Line as SkiaLine,
  Text as SkiaText,
  vec,
  useFont,
  Group,
} from "@shopify/react-native-skia";
import { CHART_TOKENS } from "../tokens";
import { smartLabel } from "../utils/scale";

interface YAxisProps {
  min: number;
  max: number;
  chartWidth: number;
  chartHeight: number;
  paddingTop: number;
  paddingLeft: number;
  gridLineColor: string;
  labelColor: string;
  formatLabel?: (value: number) => string;
  tickCount?: number;
  /** If true, labels are rendered to the right of the chart area */
  labelsRight?: boolean;
  rightEdge?: number;
}

export function YAxis({
  min,
  max,
  chartWidth,
  chartHeight,
  paddingTop,
  paddingLeft,
  gridLineColor,
  labelColor,
  formatLabel = (v) => smartLabel(v, min, max),
  tickCount = CHART_TOKENS.grid.yTickCount,
  labelsRight = false,
  rightEdge,
}: YAxisProps) {
  const font = useFont(CHART_TOKENS.font.require, CHART_TOKENS.font.axisSize);

  const ticks: { value: number; y: number }[] = [];
  for (let i = 0; i < tickCount; i++) {
    const value = min + ((max - min) * i) / (tickCount - 1);
    const normalized = (value - min) / (max - min || 1);
    const y = paddingTop + chartHeight - normalized * chartHeight;
    ticks.push({ value, y });
  }

  return (
    <>
      {ticks.map((tick, i) => (
        <Group key={`y-tick-${i}`}>
          <SkiaLine
            p1={vec(paddingLeft, tick.y)}
            p2={vec(paddingLeft + chartWidth, tick.y)}
            color={gridLineColor}
            strokeWidth={CHART_TOKENS.stroke.gridLine}
            style="stroke"
          />
          {font && (
            <SkiaText
              x={labelsRight ? (rightEdge ?? paddingLeft + chartWidth) + 8 : 2}
              y={tick.y + 3}
              text={formatLabel(tick.value)}
              font={font}
              color={labelColor}
            />
          )}
        </Group>
      ))}
    </>
  );
}

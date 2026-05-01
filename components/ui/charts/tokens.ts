/**
 * Shared design tokens for the chart library.
 * Single source of truth for spacing, typography, animation, and colors.
 */
import { Dimensions } from "react-native";
import type { ThemePalette } from "@/constants/ThemePalettes";

const SCREEN_WIDTH = Dimensions.get("window").width;

/** Responsive canvas width — accounts for mx-4 + p-4 (64px total) */
export const CHART_CANVAS_WIDTH = SCREEN_WIDTH - 64;

export const CHART_TOKENS = {
  // Typography
  font: {
    family:
      "Geist_600SemiBold" as const,
    /** Require path for useFont() */
    require: require("@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf"),
    axisSize: 9,
  },

  // Strokes
  stroke: {
    line: 2.5,
    gridLine: 1,
    baseline: 1,
    cursor: 1.5,
    barRadius: (w: number) => Math.min(6, Math.max(2, w * 0.4)),
  },

  // Spacing — three named presets
  padding: {
    /** Charts with Y/X axes (BarChart) */
    withAxes: { top: 12, right: 8, bottom: 28, left: 40 },
    /** Minimal charts without axes (SkiaBarChart, SkiaLineChart style) */
    minimal: { top: 8, right: 8, bottom: 8, left: 8 },
    /** Compact preview cards */
    preview: { top: 4, right: 4, bottom: 4, left: 4 },
  },

  // Colors (theme-relative helpers)
  colors: {
    gridLine: (theme: ThemePalette) => theme[100],
    axisLabel: (theme: ThemePalette) => theme[400],
    baseline: (theme: ThemePalette) => theme[100],
    cursor: (theme: ThemePalette) => theme[200],
    cursorDotFill: (theme: ThemePalette) => theme[50],
    emptyState: (theme: ThemePalette) => theme[400],
    headerTitle: (theme: ThemePalette) => theme[500],
  },

  // Grid
  grid: {
    yTickCount: 3, // 0%, 50%, 100%
    xLabelTarget: 4,
  },

  // Data point dots
  dot: {
    radius: 3,
    strokeWidth: 1.5,
  },

  // Touch
  touch: {
    cursorDotRadius: 5,
    cursorDotStroke: 2.5,
    hapticStart: "light" as const,
    hapticMove: "selection" as const,
  },

  // Resampling
  resampleCount: 60,
} as const;


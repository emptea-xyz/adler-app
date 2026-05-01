/**
 * CalendarHeatmap - Interactive activity heatmap with 3 zoom levels.
 *
 * Tap to cycle: year → month → week
 */
import React, { useMemo, useState, useCallback } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { haptic } from "@/lib/utils/haptic";
import { ThemedText } from "@/components/base/ThemedText";
import { useTheme } from "@/contexts/ThemeContext";
import { Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import Card, { type CardVariant } from "@/components/ui/Card";
import { generateHeatmapNarrative } from "@/lib/utils/chartNarrative";

const GAP = 2;

type TimeSpan = "year" | "month" | "week";
const TIME_SPAN_ORDER: TimeSpan[] = ["year", "month", "week"];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

interface CalendarHeatmapProps {
  workoutDates: Date[];
  /** Card visual style variant (defaults to "outline") */
  variant?: CardVariant;
  /** Optional className applied to the Card wrapper */
  className?: string;
  /** When provided, shows a chevron next to the count label and calls this on press */
  onDetailPress?: () => void;
}

export function CalendarHeatmap({ workoutDates, variant = "outline", className, onDetailPress }: CalendarHeatmapProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const { theme, signalColors } = useTheme();
  const [timeSpan, setTimeSpan] = useState<TimeSpan>("year");

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    haptic("light");
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 150 }),
    );
    const currentIndex = TIME_SPAN_ORDER.indexOf(timeSpan);
    setTimeSpan(TIME_SPAN_ORDER[(currentIndex + 1) % TIME_SPAN_ORDER.length]);
  }, [timeSpan, scale]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // Date lookup set
  const workoutDateSet = useMemo(() => {
    const set = new Set<string>();
    workoutDates.forEach((date) => {
      const d = new Date(date);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    return set;
  }, [workoutDates]);

  const checkWorkout = useCallback(
    (date: Date) => workoutDateSet.has(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`),
    [workoutDateSet],
  );

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const currentYear = today.getFullYear();

  // theme[100] matches the filled-card background, so the "None" swatch +
  // empty grid cells go one step away (theme[200]) to stay visible.
  const emptyColor = theme[200];
  const futureColor = theme[300];
  const activeColor = signalColors.lp[500];
  const todayColor = theme[950];

  const getCellColor = (isToday: boolean, worked: boolean, isFuture?: boolean) => {
    if (isToday) return todayColor;
    if (worked) return activeColor;
    if (isFuture) return futureColor;
    return emptyColor;
  };

  // --- Data ---

  const yearData = useMemo(() => {
    const days: { date: Date; isToday: boolean; isFuture: boolean; worked: boolean }[] = [];
    let workedCount = 0;
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(currentYear, m, d);
        const worked = checkWorkout(date);
        if (worked) workedCount++;
        days.push({ date, isToday: date.getTime() === today.getTime(), isFuture: date > today, worked });
      }
    }
    return { days, workedCount, totalDays: days.length };
  }, [currentYear, today, checkWorkout]);

  const monthData = useMemo(() => {
    const days: { date: Date; isToday: boolean; worked: boolean }[] = [];
    let workedCount = 0;
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const worked = checkWorkout(date);
      if (worked) workedCount++;
      days.push({ date, isToday: i === 0, worked });
    }
    return { days, workedCount, totalDays: days.length };
  }, [today, checkWorkout]);

  const weekData = useMemo(() => {
    const days: { date: Date; isToday: boolean; worked: boolean; label: string }[] = [];
    let workedCount = 0;
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dayOfWeek = date.getDay();
      const worked = checkWorkout(date);
      if (worked) workedCount++;
      days.push({ date, isToday: i === 0, worked, label: DAY_LABELS[dayOfWeek === 0 ? 6 : dayOfWeek - 1] });
    }
    return { days, workedCount, totalDays: days.length };
  }, [today, checkWorkout]);

  // Cell sizes derived from measured container width
  const yearCols = containerWidth > 0 ? Math.floor((containerWidth + GAP) / (12 + GAP)) : 0;
  const yearCellSize = yearCols > 0 ? (containerWidth - (yearCols - 1) * GAP) / yearCols : 0;
  const monthCellSize = containerWidth > 0 ? (containerWidth - 9 * GAP) / 10 : 0;
  const weekPillarWidth = containerWidth > 0 ? (containerWidth - 6 * GAP) / 7 : 0;

  // --- Shared rendering ---

  const yearGrid = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
      {yearData.days.map((day, idx) => (
        <View
          key={idx}
          style={{
            width: yearCellSize,
            height: yearCellSize,
            borderRadius: 2,
            backgroundColor: getCellColor(day.isToday, day.worked, day.isFuture),
          }}
        />
      ))}
    </View>
  );

  const currentSpanData = timeSpan === "year" ? yearData : timeSpan === "month" ? monthData : weekData;
  const heatmapNarrative = generateHeatmapNarrative(currentSpanData.workedCount, currentSpanData.totalDays);

  return (
    <Card
      variant={variant}
      className={className}
      style={animatedStyle}
      animated
      onPress={handlePress}
      accessibilityRole="image"
      accessibilityLabel={heatmapNarrative}
    >
      <View onLayout={handleLayout}>
        {/* Header */}
        <View className="pb-4 flex-row justify-between items-center">
          <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
            {timeSpan === "year" ? `${currentYear}` : timeSpan === "month" ? "Last 30 Days" : "Last 7 Days"}
          </ThemedText>
          {onDetailPress ? (
            <Pressable onPress={onDetailPress} className="flex-row items-center gap-1" hitSlop={8}>
              <ThemedText type="body-xs-semibold" style={{ color: theme[400] }}>
                {currentSpanData.workedCount}/{currentSpanData.totalDays}
              </ThemedText>
              <ChevronRight size={14} color={theme[400]} />
            </Pressable>
          ) : (
            <ThemedText type="body-xs-semibold" style={{ color: theme[400] }}>
              {currentSpanData.workedCount}/{currentSpanData.totalDays}
            </ThemedText>
          )}
        </View>

        {/* Grids */}
        {containerWidth > 0 && (
          <>
            {timeSpan === "year" && yearGrid}

            {timeSpan === "month" && (
              <View style={{ gap: GAP }}>
                {[0, 1, 2].map((rowIdx) => (
                  <View key={rowIdx} style={{ flexDirection: "row", gap: GAP }}>
                    {Array.from({ length: 10 }).map((_, colIdx) => {
                      const day = monthData.days[rowIdx * 10 + colIdx];
                      return (
                        <View key={colIdx} style={{ width: monthCellSize, height: monthCellSize, borderRadius: 4, backgroundColor: getCellColor(day.isToday, day.worked) }} />
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            {timeSpan === "week" && (
              <View style={{ flexDirection: "row", gap: GAP, alignItems: "flex-end" }}>
                {weekData.days.map((day, idx) => (
                  <View key={idx} style={{ alignItems: "center" }}>
                    <View style={{ width: weekPillarWidth, height: 80, borderRadius: 4, backgroundColor: getCellColor(day.isToday, day.worked) }} />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Legend */}
        <View className="flex-row items-center justify-end mt-4 gap-4">
          {[{ label: "None", color: emptyColor }, { label: "Workout", color: activeColor }, { label: "Today", color: todayColor }].map(({ label, color }) => (
            <View key={label} className="flex-row items-center gap-1.5">
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
              <ThemedText type="body-xs" style={{ color: theme[400] }}>{label}</ThemedText>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

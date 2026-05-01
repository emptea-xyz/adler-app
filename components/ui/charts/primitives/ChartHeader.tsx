/**
 * ChartHeader - Title (left) + active value (right) layout.
 */
import React from "react";
import { View } from "react-native";
import { ThemedText } from "@/components/base/ThemedText";
import { useTheme } from "@/contexts/ThemeContext";
import { ChevronRight } from "lucide-react-native";

interface ChartHeaderProps {
  title: string;
  value?: string | number | null;
  unit?: string;
  label?: string;
  color?: string;
  formatValue?: (value: number) => string;
  showChevron?: boolean;
}

export function ChartHeader({
  title,
  value,
  unit,
  label,
  color,
  formatValue = (v) => v.toLocaleString(),
  showChevron,
}: ChartHeaderProps) {
  const { theme } = useTheme();
  const accentColor = color ?? theme[500];

  const displayValue =
    value != null
      ? typeof value === "number"
        ? formatValue(value)
        : value
      : null;

  return (
    <View className="flex-row justify-between items-start mb-4" style={{ minHeight: 40 }}>
      <View>
        <View className="flex-row items-center gap-1">
          <ThemedText
            type="body-sm"
            style={{ color: theme[950] }}
          >
            {title}
          </ThemedText>
          {showChevron && <ChevronRight size={14} color={theme[400]} />}
        </View>
        {label ? (
          <ThemedText type="body-xs" style={{ color: theme[400] }}>
            {label}
          </ThemedText>
        ) : null}
      </View>

      {displayValue != null && (
        <View className="flex-row items-baseline justify-end gap-2">
          <ThemedText type="h4" className="font-geist" style={{ color: accentColor }}>
            {displayValue}
          </ThemedText>
          {unit ? (
            <ThemedText type="body-xs" style={{ color: accentColor }}>
              {unit}
            </ThemedText>
          ) : null}
        </View>
      )}
    </View>
  );
}

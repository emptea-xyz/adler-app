import React from "react";
import { ThemedText } from "@/components/base/ThemedText";
import { useTheme } from "@/contexts/ThemeContext";

// Figma node 36:93 — small caption-style eyebrow above body content. Mixed
// case (the design's example reads "Section", not "SECTION").

interface SectionLabelProps {
  label: string;
}

export function SectionLabel({ label }: SectionLabelProps) {
  const { theme } = useTheme();
  return (
    <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
      {label}
    </ThemedText>
  );
}

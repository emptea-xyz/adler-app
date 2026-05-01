import React from "react";
import { ThemedText } from "@/components/base/ThemedText";

interface SectionLabelProps {
  label: string;
}

/**
 * Settings section header — small uppercase eyebrow with wide tracking.
 * Use this for grouping rows on settings-style screens. Reads as a
 * structural divider without competing with the screen title.
 */
export function SectionLabel({ label }: SectionLabelProps) {
  return (
    <ThemedText
      type="body-xs"
      className="opacity-50 mb-2 px-screen tracking-widest uppercase"
    >
      {label}
    </ThemedText>
  );
}

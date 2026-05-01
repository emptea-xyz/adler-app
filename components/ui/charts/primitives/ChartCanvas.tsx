/**
 * ChartCanvas - Wraps Skia Canvas with optional GestureDetector.
 */
import React from "react";
import { Canvas } from "@shopify/react-native-skia";
import { GestureDetector } from "react-native-gesture-handler";
import type { GestureType } from "react-native-gesture-handler";

interface ChartCanvasProps {
  width: number;
  height: number;
  gesture?: GestureType;
  children: React.ReactNode;
}

export function ChartCanvas({ width, height, gesture, children }: ChartCanvasProps) {
  const canvas = (
    <Canvas style={{ width, height }}>
      {children}
    </Canvas>
  );

  if (gesture) {
    return <GestureDetector gesture={gesture}>{canvas}</GestureDetector>;
  }

  return canvas;
}

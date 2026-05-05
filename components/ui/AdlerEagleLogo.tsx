import React from 'react';
import EagleSvg from '@/assets/images/eagle-compact.svg';

// Figma node 57:259 — sign-in hero logo. Loaded via react-native-svg-transformer
// (metro.config.js). `eagle-compact.svg` is pixel-identical to
// `eagle-original.svg` with 221 redundant paths removed. ViewBox 133 × 171.

interface Props {
  size?: number;
}

export function AdlerEagleLogo({ size = 171 }: Props) {
  const aspect = 133 / 171;
  return <EagleSvg width={size * aspect} height={size} />;
}

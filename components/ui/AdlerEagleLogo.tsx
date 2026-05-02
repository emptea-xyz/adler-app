import React from 'react';
import EagleSvg from '@/assets/images/adler-eagle.svg';

// Figma node 57:259 — sign-in hero logo. The 553KB SVG is loaded via
// react-native-svg-transformer (metro.config.js) — paths preserved verbatim
// from the Figma export. ViewBox is 133 × 171.

interface Props {
  size?: number;
}

export function AdlerEagleLogo({ size = 171 }: Props) {
  const aspect = 133 / 171;
  return <EagleSvg width={size * aspect} height={size} />;
}

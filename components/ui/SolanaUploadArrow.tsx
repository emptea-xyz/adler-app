import React from 'react';
import { Canvas, Group, Path, LinearGradient, Shadow, vec } from '@shopify/react-native-skia';
import { Accent } from '@/constants/ThemePalettes';
import { Neutral } from '@/constants/NeutralColors';

// Figma node 132:157 — center "Create" tab icon. Paths copied verbatim from
// the Figma SVG export (per Rule Zero of design-code-migration.md).
//
// Source viewBox: 63.4667 x 60. Four paths in z-order:
//   1. White outer triangle envelope (provides contrast halo on any bg).
//   2. Inner triangle filled with the pink Adler gradient (#FF0088 → #BE185D top→bottom).
//   3. Upper horizontal bar.
//   4. Lower horizontal bar.

const VB_W = 63.4667;
const VB_H = 60;

const PATH_OUTER = 'M15.5556 35.5111V54H47.9111V35.5111H59.4667L31.7333 2L4 35.5111H15.5556Z';
const PATH_TRI = 'M17.8667 33.2V37.8222H45.6V33.2H54.8444L31.7333 5.46667L8.62222 33.2H17.8667Z';
const PATH_BAR_1 = 'M45.6 40.1333H17.8667V44.7556H45.6V40.1333Z';
const PATH_BAR_2 = 'M45.6 47.0667H17.8667V51.6889H45.6V47.0667Z';

interface Props {
  size?: number;
}

export function SolanaUploadArrow({ size = 52 }: Props) {
  const aspect = VB_W / VB_H;
  // Pad the canvas so the drop shadow isn't clipped at the edges.
  const padding = 6;
  const width = size * aspect + padding * 2;
  const height = size + padding * 2;
  const scale = size / VB_H;

  return (
    <Canvas style={{ width, height }}>
      <Group transform={[{ translateX: padding, translateY: padding }, { scale }]}>
        <Path path={PATH_OUTER} color={Neutral.white}>
          <Shadow dx={0} dy={2} blur={3} color="rgba(0,0,0,0.12)" />
        </Path>
        <Path path={PATH_TRI}>
          <LinearGradient
            start={vec(31.7333, 2)}
            end={vec(31.7333, 54)}
            colors={[Accent.pink, Accent.pinkDark]}
          />
        </Path>
        <Path path={PATH_BAR_1}>
          <LinearGradient
            start={vec(31.7333, 2)}
            end={vec(31.7333, 54)}
            colors={[Accent.pink, Accent.pinkDark]}
          />
        </Path>
        <Path path={PATH_BAR_2}>
          <LinearGradient
            start={vec(31.7333, 2)}
            end={vec(31.7333, 54)}
            colors={[Accent.pink, Accent.pinkDark]}
          />
        </Path>
      </Group>
    </Canvas>
  );
}

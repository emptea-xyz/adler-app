import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Canonical Solana logo — three slanted bars in a single solid fill.
// Paths copied verbatim from the Solana brand kit SVG export
// (per Rule Zero of design-code-migration.md).
//
// Source viewBox: 397.7 x 311.7. Three paths in z-order:
//   1. Top bar
//   2. Middle bar
//   3. Bottom bar

const VB_W = 397.7;
const VB_H = 311.7;

const TOP =
    'M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 237.9z';
const MID =
    'M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z';
const BOT =
    'M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1L333.1 120.1z';

interface SolanaIconProps {
    /** Rendered height in dp; width follows the canonical 397.7:311.7 ratio. */
    size?: number;
    /** Fill color. Defaults to solid black. */
    color?: string;
}

export function SolanaIcon({ size = 24, color = '#000000' }: SolanaIconProps) {
    const aspect = VB_W / VB_H;
    const width = size * aspect;

    return (
        <Svg width={width} height={size} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <Path d={TOP} fill={color} />
            <Path d={MID} fill={color} />
            <Path d={BOT} fill={color} />
        </Svg>
    );
}

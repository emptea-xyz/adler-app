/**
 * ThemeColors.ts
 *
 * Semantic color tokens for the Crank app.
 * All colors are derived from TailwindColors to maintain consistency.
 */

import { TailwindColors } from './TailwindColors';

export const ThemeColors = {
    // ─────────────────────────────────────────────────────────────────
    // STATUS & FEEDBACK
    // ─────────────────────────────────────────────────────────────────
    status: {
        success: {
            background: { light: TailwindColors.green[100] },
            text: { light: TailwindColors.green[800] },
            solid: TailwindColors.green[500],
        },
        error: {
            background: { light: TailwindColors.red[100] },
            text: { light: TailwindColors.red[800] },
            solid: TailwindColors.red[500],
        },
        warning: {
            background: { light: TailwindColors.amber[100] },
            text: { light: TailwindColors.amber[800] },
            solid: TailwindColors.amber[500],
        },
        info: {
            background: { light: TailwindColors.sky[100] },
            text: { light: TailwindColors.sky[800] },
            solid: TailwindColors.sky[500],
        },
    },

    // ─────────────────────────────────────────────────────────────────
    // SPECIAL SCREENS
    // ─────────────────────────────────────────────────────────────────
    special: {
        /** Auth screen hero background */
        authHero: 'rgba(0, 0, 0, 1)',
        /** Gradient overlay colors (top → bottom) */
        gradientOverlay: [
            'rgba(0, 0, 0, 0.0)',
            'rgba(0, 0, 0, 0.4)',
            'rgba(0, 0, 0, 0.6)',
            'rgba(0, 0, 0, 0.5)',
            'rgba(0, 0, 0, 0.7)',
            'rgba(0, 0, 0, 0.8)',
        ] as const,
    },
} as const;

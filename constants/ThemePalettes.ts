/**
 * Theme palette for Adler. One palette: pure neutrals. Two appearances:
 * light and dark — produced by inverting the palette at render time. The
 * single brand accent is Tailwind's default `sky` palette; use it via
 * `TailwindColors.sky[N]` directly (no wrapper, no rebrand layer).
 *
 * Shade conventions:
 * - theme[50]: app background, lightest surfaces
 * - theme[100-200]: card backgrounds, subtle borders
 * - theme[300-400]: tertiary text, placeholders, disabled states
 * - theme[500]: muted secondary text — the most common "quiet" color
 * - theme[600-700]: emphasis text, icons
 * - theme[800-900]: primary text, headings
 * - theme[950]: darkest elements
 */
import { TailwindColors } from "./TailwindColors";

export interface ThemePalette {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
}

export const MONO_PALETTE: ThemePalette = {
    50: TailwindColors.neutral[50],
    100: TailwindColors.neutral[100],
    200: TailwindColors.neutral[200],
    300: TailwindColors.neutral[300],
    400: TailwindColors.neutral[400],
    500: TailwindColors.neutral[500],
    600: TailwindColors.neutral[600],
    700: TailwindColors.neutral[700],
    800: TailwindColors.neutral[800],
    900: TailwindColors.neutral[900],
    950: TailwindColors.neutral[950],
};

/**
 * Single brand accent — Tailwind sky. Re-exported so chart primitives that
 * want a 300→700 ramp don't have to know the underlying name. For new code,
 * import `TailwindColors.sky` directly.
 */
export const SIGNAL_COLORS = {
    accent: TailwindColors.sky,
} as const;

/** Mirrors a palette across the 500 axis: 50↔950, 100↔900, … 400↔600. */
export function invertPalette(palette: ThemePalette): ThemePalette {
    return {
        50: palette[950],
        100: palette[900],
        200: palette[800],
        300: palette[700],
        400: palette[600],
        500: palette[500],
        600: palette[400],
        700: palette[300],
        800: palette[200],
        900: palette[100],
        950: palette[50],
    };
}

export const DARK_MONO_PALETTE: ThemePalette = invertPalette(MONO_PALETTE);

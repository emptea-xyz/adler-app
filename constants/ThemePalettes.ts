/**
 * Theme palette for Adler. One palette: mono. Two appearances: light and
 * dark — produced by inverting the palette at render time. Multi-accent
 * theming is intentionally out of scope.
 *
 * Shade conventions:
 * - theme[50]: app background, lightest surfaces
 * - theme[100-200]: card backgrounds, subtle borders
 * - theme[300-400]: secondary text, disabled states
 * - theme[500]: primary accent (sky-blue brand color)
 * - theme[600-700]: hover states, emphasis
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
    500: TailwindColors.sky[500],     // brand accent — sky-blue
    600: TailwindColors.neutral[600],
    700: TailwindColors.neutral[700],
    800: TailwindColors.neutral[800],
    900: TailwindColors.neutral[900],
    950: TailwindColors.neutral[950],
};

/**
 * Inverts a palette for dark mode: swaps light ↔ dark shades. Shade 500
 * (accent midpoint) stays in place.
 */
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

/**
 * SIGNAL PALETTE — accent palette for charts, data series, and decorative
 * elements. Sourced from Tailwind's default palette.
 *
 * Usage: SIGNAL_PALETTE.blue[500], SIGNAL_PALETTE.red[400], etc.
 */
export const SIGNAL_PALETTE = {
    red: TailwindColors.red,
    yellow: TailwindColors.amber,
    green: TailwindColors.emerald,
    sky: TailwindColors.sky,
    blue: TailwindColors.blue,
    indigo: TailwindColors.indigo,
    purple: TailwindColors.purple,
    pink: TailwindColors.pink,
} as const;

/**
 * ACCENT PALETTE — fixed brand hues for status pills, signal accents, and
 * decorative surfaces (sign-in halo, inbox underline). Theme-independent: each
 * value renders identically in light and dark mode. Pair with `useTheme()`
 * neutrals when a surrounding surface needs to flip.
 */
export const ACCENT_COLORS = {
    pink: '#ff0088',
    cyan: '#00d4ff',
    lime: '#4cd900',
    orange: '#ff5900',
} as const;

/**
 * Static signal slots used across the app's accent surfaces. Values are
 * theme-independent (we only have one theme) — `useTheme().signalColors` is
 * just this object.
 */
export const SIGNAL_COLORS = {
    /** Primary brand accent (buttons, highlights, active states) */
    accent: SIGNAL_PALETTE.sky,
    /** Multi-step intensity ramp for relationship/heatmap visuals */
    ramp: {
        '50': TailwindColors.emerald[500],
        '100': TailwindColors.teal[500],
        '200': TailwindColors.cyan[500],
        '300': TailwindColors.sky[500],
        '400': TailwindColors.blue[500],
        '500': TailwindColors.indigo[500],
        '600': TailwindColors.violet[500],
        '700': TailwindColors.purple[500],
        '800': TailwindColors.fuchsia[500],
        '900': TailwindColors.pink[500],
        '950': TailwindColors.rose[500],
    },
} as const;

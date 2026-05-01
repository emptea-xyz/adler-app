/**
 * Theme color configuration for the app's theming system.
 * Each theme provides a full Tailwind palette (50-950) for app-wide styling.
 *
 * Usage:
 * - theme[50]: App background, lightest surfaces
 * - theme[100-200]: Card backgrounds, subtle borders
 * - theme[300-400]: Secondary text, disabled states
 * - theme[500]: Primary accent, buttons
 * - theme[600-700]: Hover states, emphasis
 * - theme[800-900]: Primary text, headings
 * - theme[950]: Darkest elements
 */
import { TailwindColors } from "./TailwindColors";

export type ThemeName =
    'mono' | 'red' | 'orange' | 'yellow' | 'emerald' | 'blue' | 'violet' | 'pink';

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

export const THEME_COLORS: Record<ThemeName, ThemePalette> = {
    mono: {
        50: TailwindColors.neutral[50],   // #fafafa — softened from pure white
        100: TailwindColors.neutral[100],
        200: TailwindColors.neutral[200],
        300: TailwindColors.neutral[300],
        400: TailwindColors.neutral[400],
        500: TailwindColors.sky[500],     // brand accent — sky-blue
        600: TailwindColors.neutral[600],
        700: TailwindColors.neutral[700],
        800: TailwindColors.neutral[800],
        900: TailwindColors.neutral[900],
        950: TailwindColors.neutral[950], // #0a0a0a — softened from pure black
    },
    red: TailwindColors.red,
    orange: TailwindColors.orange,
    yellow: TailwindColors.yellow,
    emerald: TailwindColors.emerald,
    blue: TailwindColors.blue,
    violet: TailwindColors.violet,
    pink: TailwindColors.pink,
};

export const DEFAULT_THEME: ThemeName = 'mono';


/**
 * Inverts a palette for dark mode: swaps light ↔ dark shades.
 * Shade 500 (accent midpoint) stays in place.
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

export const THEME_LIST: ThemeName[] = Object.keys(THEME_COLORS) as ThemeName[];

/**
 * SIGNAL PALETTE — 8-color accent palette for charts, data series, and decorative elements.
 * Sourced from Tailwind's default palette (Figma reference).
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
 * SINGLE SOURCE OF TRUTH for signal colors
 * 
 * These colors are consistent across ALL themes and should be used for:
 * - Level Points (LP) - Sky Blue
 * - Muscle Points (MP) - Green  
 * - Personal Records (PR) - Indigo
 * - Streak/Fire - Orange
 * 
 * Use via: const { signalColors } = useTheme();
 */
export const SIGNAL_COLORS = {
    /** Primary action, e.g. floating action button gradient */
    action: SIGNAL_PALETTE.sky,
    /** Body map muscle intensity ramp */
    bodyMap: {
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
    /** Level Points (LP) - Sky Blue */
    lp: SIGNAL_PALETTE.sky,
    /** Muscle Points (MP) - Green */
    mp: SIGNAL_PALETTE.green,
    /** Personal Records (PR) - Sky Blue */
    pr: SIGNAL_PALETTE.sky,
} as const;

const PALETTE_KEYS = ['red', 'yellow', 'green', 'blue', 'indigo', 'purple', 'pink'] as const;
const SHADE_ORDER = [500, 50, 100, 200, 300, 400, 600, 700, 800, 900, 950] as const;

export const CHART_ROTATION = SHADE_ORDER.flatMap(
    shade => PALETTE_KEYS.map(key => SIGNAL_PALETTE[key][shade])
);

/** 7-color rotation for folder icons, using [500] shade of each signal color */
export const FOLDER_COLOR_ROTATION = PALETTE_KEYS.map(key => SIGNAL_PALETTE[key][500]);

/**
 * Get theme-aware level color.
 * Returns bodyMap (sky) palette when themeName === 'mono',
 * otherwise returns theme palette progression (100→900).
 */
export function getThemeAwareLevelColor(
    level: number,
    theme: ThemePalette,
    themeName: ThemeName
): string {
    // Mono theme uses bodyMap signal color (sky)
    if (themeName === 'mono') {
        const shadeKeys: Array<keyof ThemePalette> = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
        const clampedLevel = Math.max(0, Math.min(level, shadeKeys.length - 1));
        return SIGNAL_COLORS.bodyMap[shadeKeys[clampedLevel]];
    }

    // Other themes use palette progression: 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
    const paletteKeys: Array<keyof ThemePalette> = [100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
    const clampedLevel = Math.max(0, Math.min(level, paletteKeys.length - 1));
    const key = paletteKeys[clampedLevel];
    return theme[key];
}

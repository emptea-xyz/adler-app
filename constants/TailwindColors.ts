import colors from "tailwindcss/colors";

export const TailwindColors = {
  slate: colors.slate,
  gray: colors.gray,
  zinc: colors.zinc,
  neutral: colors.neutral,
  stone: colors.stone,
  red: colors.red,
  orange: colors.orange,
  amber: colors.amber,
  yellow: colors.yellow,
  lime: colors.lime,
  green: colors.green,
  emerald: colors.emerald,
  teal: colors.teal,
  cyan: colors.cyan,
  sky: colors.sky,
  blue: colors.blue,
  indigo: colors.indigo,
  violet: colors.violet,
  purple: colors.purple,
  fuchsia: colors.fuchsia,
  pink: colors.pink,
  rose: colors.rose,
  black: colors.black,
  white: colors.white,
} as const;

export type TailwindShade =
  | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

const SHADE_MIRROR: Record<TailwindShade, TailwindShade> = {
  50: 950,
  100: 900,
  200: 800,
  300: 700,
  400: 600,
  500: 500,
  600: 400,
  700: 300,
  800: 200,
  900: 100,
  950: 50,
};

/** Returns the mirrored shade across the 500 axis. 50↔950, 100↔900, etc. */
export function invertShade(shade: TailwindShade): TailwindShade {
  return SHADE_MIRROR[shade];
}

type Hued = typeof colors.sky;

/** Returns a new palette object with every numeric shade key mirrored. */
export function invertTailwindPalette(palette: Hued): Hued {
  const out: Record<string, string> = {};
  for (const key of Object.keys(palette) as (keyof Hued)[]) {
    const n = Number(key);
    if (Number.isFinite(n) && n in SHADE_MIRROR) {
      out[String(SHADE_MIRROR[n as TailwindShade])] = palette[key as keyof Hued] as string;
    } else {
      out[key as string] = palette[key as keyof Hued] as string;
    }
  }
  return out as Hued;
}

type HuedKey = Exclude<keyof typeof TailwindColors, 'black' | 'white'>;

/** Mode-aware Tailwind palette. In dark mode, every hue has its shades mirrored. */
export function buildModeAwareTailwind(isDark: boolean): typeof TailwindColors {
  if (!isDark) return TailwindColors;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(TailwindColors) as (keyof typeof TailwindColors)[]) {
    if (key === 'black' || key === 'white') {
      out[key] = TailwindColors[key];
    } else {
      out[key] = invertTailwindPalette(TailwindColors[key as HuedKey] as Hued);
    }
  }
  return out as typeof TailwindColors;
}

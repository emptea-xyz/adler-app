import { Text, type TextProps } from 'react-native';
import { cn } from '@/components/utils/cn';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemePalette } from '@/constants/ThemePalettes';

/**
 * Typography variants define ONLY:
 * - font-family
 * - font-size
 * - line-height
 * - letter-spacing (where applicable)
 *
 * Color defaults are applied via the theme palette (can be overridden via `style`).
 */

// Heading variants (Geist SemiBold)
type HeadingVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

// Body variants (Geist) - from 3xl down to xs
type BodyVariant =
  | 'body-3xl' | 'body-3xl-semibold'
  | 'body-2xl' | 'body-2xl-semibold'
  | 'body-xl' | 'body-xl-semibold'
  | 'body-lg' | 'body-lg-semibold'
  | 'body-md' | 'body-md-semibold'
  | 'body-sm' | 'body-sm-semibold'
  | 'body-xs' | 'body-xs-semibold';

// UI-specific variants
type UIVariant = 'caption' | 'caption-semibold' | 'label' | 'label-semibold';

type Variant = HeadingVariant | BodyVariant | UIVariant;

/**
 * Typography-only classes (no color).
 * Each variant defines: font-family, font-size, line-height, letter-spacing
 */
const variantClasses: Record<Variant, string> = {
  // Headings (Geist SemiBold) — h1 largest, h6 smallest. -3% tracking everywhere.
  h1: 'font-geist-semibold text-[48px] leading-[60px] tracking-adler',
  h2: 'font-geist-semibold text-[36px] leading-[44px] tracking-adler',
  h3: 'font-geist-semibold text-[28px] leading-[36px] tracking-adler',
  h4: 'font-geist-semibold text-[24px] leading-[32px] tracking-adler',
  h5: 'font-geist-semibold text-[20px] leading-[28px] tracking-adler',
  h6: 'font-geist-semibold text-[18px] leading-[26px] tracking-adler',

  // Body (Geist Regular)
  'body-3xl': 'font-geist text-[24px] leading-[32px] tracking-adler',
  'body-2xl': 'font-geist text-[20px] leading-[28px] tracking-adler',
  'body-xl': 'font-geist text-[18px] leading-[26px] tracking-adler',
  'body-lg': 'font-geist text-[16px] leading-[24px] tracking-adler',
  'body-md': 'font-geist text-[14px] leading-[20px] tracking-adler',
  'body-sm': 'font-geist text-[13px] leading-[18px] tracking-adler',
  'body-xs': 'font-geist text-[12px] leading-[16px] tracking-adler',

  // Body (Geist SemiBold)
  'body-3xl-semibold': 'font-geist-semibold text-[24px] leading-[32px] tracking-adler',
  'body-2xl-semibold': 'font-geist-semibold text-[20px] leading-[28px] tracking-adler',
  'body-xl-semibold': 'font-geist-semibold text-[18px] leading-[26px] tracking-adler',
  'body-lg-semibold': 'font-geist-semibold text-[16px] leading-[24px] tracking-adler',
  'body-md-semibold': 'font-geist-semibold text-[14px] leading-[20px] tracking-adler',
  'body-sm-semibold': 'font-geist-semibold text-[13px] leading-[18px] tracking-adler',
  'body-xs-semibold': 'font-geist-semibold text-[12px] leading-[16px] tracking-adler',

  // UI
  caption: 'font-geist text-[11px] leading-[14px] tracking-adler',
  'caption-semibold': 'font-geist-semibold text-[11px] leading-[14px] tracking-adler',
  label: 'font-geist text-[11px] leading-[14px] tracking-adler',
  'label-semibold': 'font-geist-semibold text-[11px] leading-[14px] tracking-adler',
};


/**
 * Default theme shade per variant category.
 * Headings + bold/medium/black + regular body → theme[950] (primary text)
 * Small/secondary text (body-sm, body-xs, caption, label) → theme[500] (secondary text)
 */
const getDefaultColor = (variant: Variant, theme: ThemePalette): string => {
  // Headings always primary
  if (variant.startsWith('h')) return theme[950];

  // Strip -semibold suffix — font weight shouldn't affect default color
  const base = variant.replace('-semibold', '');

  // Larger body sizes → primary
  if (base === 'body-lg' || base === 'body-md' ||
    base === 'body-xl' || base === 'body-2xl' || base === 'body-3xl')
    return theme[950];

  // Everything else (body-sm, body-xs, caption, label) → secondary
  return theme[500];
};


type ThemedTextProps = TextProps & {
  /** Semantic typography variant (font-family, size, line-height, letter-spacing) */
  type?: Variant;
  /** Semantic text alignment */
  align?: 'left' | 'center' | 'right' | 'justify';
};

export function ThemedText({
  type = 'body-lg',
  align,
  className,
  style,
  ...rest
}: ThemedTextProps) {
  const { theme } = useTheme();
  const defaultColor = getDefaultColor(type, theme);

  return (
    <Text
      style={[{ color: defaultColor }, style]}
      className={cn(
        variantClasses[type],
        align && `text-${align}`,
        className
      )}
      {...rest}
    />
  );
}

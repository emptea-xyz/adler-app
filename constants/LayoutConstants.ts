/**
 * LayoutConstants.ts
 * 
 * Standardized spacing, sizing, and layout values for the Adler app.
 * Use these instead of hardcoded "magic numbers" throughout the codebase.
 * 
 * Naming Convention:
 *   - SPACING_* : General spacing values (margins, padding, gaps)
 *   - SIZE_*    : Component sizes (heights, widths)
 *   - RADIUS_*  : Border radius values
 *   - INSET_*   : Screen edge insets
 */

/** Height of the tab bar (excluding safe-area inset) */
export const TAB_BAR_HEIGHT = 80;

// ─────────────────────────────────────────────────────────────────
// COMPONENT SIZING
// ─────────────────────────────────────────────────────────────────

/** Standard 36×36 circular icon button (header bell, settings gear, etc.) */
export const ICON_BUTTON_SIZE = 36;
/** Half of ICON_BUTTON_SIZE for full-circle radius */
export const ICON_BUTTON_RADIUS = ICON_BUTTON_SIZE / 2;
// ─────────────────────────────────────────────────────────────────
// CORNER RADII
// ─────────────────────────────────────────────────────────────────

export const Radius = {
    /** Cards, dropdowns, popovers */
    sm: 8,
    /** Buttons, sheet inputs */
    md: 12,
    /** Avatars (square-ish) */
    lg: 16,
    /** Pills, fully-rounded badges, circle buttons */
    full: 9999,
} as const;

// ─────────────────────────────────────────────────────────────────
// SHADOWS (RN style)
// ─────────────────────────────────────────────────────────────────

export const Shadow = {
    /** Soft popover/dropdown elevation */
    md: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 8,
    },
} as const;

// ─────────────────────────────────────────────────────────────────
// ANIMATION TIMING
// ─────────────────────────────────────────────────────────────────

export const AnimationDuration = {
    /** 150ms - Quick micro-interactions */
    fast: 150,
    /** 200ms - Standard transitions */
    normal: 200,
    /** 300ms - Emphasized transitions */
    slow: 300,
    /** 400ms - Modal/sheet animations */
    sheet: 400,
    /** 500ms - Page transitions */
    page: 500,
    /** 800ms - Skeleton pulse */
    pulse: 800,
} as const;


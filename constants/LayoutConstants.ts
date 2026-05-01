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

import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────
// SCREEN DIMENSIONS
// ─────────────────────────────────────────────────────────────────

export const Screen = {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    isSmall: SCREEN_WIDTH < 375, // iPhone SE
    isMedium: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414,
    isLarge: SCREEN_WIDTH >= 414,
} as const;

// ─────────────────────────────────────────────────────────────────
// TAB BAR
// ─────────────────────────────────────────────────────────────────

/** Height of the tab bar (excluding safe-area inset) */
export const TAB_BAR_HEIGHT = 60;

/** Height of the interaction bar above the tab bar */
export const INTERACTION_BAR_HEIGHT = 44;

/** Height of the gradient fade zone that extends above the tab icons */
export const TAB_BAR_GRADIENT_HEIGHT = 40;

// ─────────────────────────────────────────────────────────────────
// BOTTOM INSETS (for scrollable content inside (home) tab screens)
// ─────────────────────────────────────────────────────────────────

export const BottomInset = {
    /** Tab bar height + safe area buffer */
    withTabBar: TAB_BAR_HEIGHT + 40,

    /** Standard scroll padding for screens with tab bar */
    scrollWithTabBar: TAB_BAR_HEIGHT + 60,

    /** Extended scroll padding for screens with FAB or actions */
    scrollWithActions: TAB_BAR_HEIGHT + 80,

    /** Scroll padding for screens with large bottom actions */
    scrollWithLargeActions: TAB_BAR_HEIGHT + 100,

    /** Minimal scroll padding for simple screens (20px) */
    scrollMinimal: 20,
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



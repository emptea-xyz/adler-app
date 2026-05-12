/**
 * ThemeContext — light mode only.
 *
 * Dark mode was removed on 2026-05-11 to keep visual output deterministic for
 * marketing, screenshots, and hardcoded hex values that don't flip. The
 * provider keeps the previous public API (`theme`, `isDark`, `colorScheme`,
 * `setColorScheme`) so existing call sites compile unchanged — but
 * `colorScheme` is always `'light'`, `isDark` is always `false`, and
 * `setColorScheme` is a no-op.
 */
import React, { createContext, useContext, useMemo } from 'react';
import {
    ThemePalette,
    MONO_PALETTE,
    SIGNAL_COLORS,
} from '@/constants/ThemePalettes';

type ColorScheme = 'system' | 'light' | 'dark';

interface ThemeContextType {
    /** Light palette. */
    theme: ThemePalette;
    /** Static signal colors (accent only). */
    signalColors: typeof SIGNAL_COLORS;
    /** Always `false`. Retained for ABI compat. */
    isDark: boolean;
    /** Always `'light'`. Retained for ABI compat. */
    colorScheme: ColorScheme;
    /** No-op. Retained for ABI compat. */
    setColorScheme: (scheme: ColorScheme) => Promise<void>;
    /** Always `false`. */
    isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const NOOP_SET_COLOR_SCHEME = async () => {
    // intentional no-op; see file header
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const value = useMemo<ThemeContextType>(
        () => ({
            theme: MONO_PALETTE,
            signalColors: SIGNAL_COLORS,
            isDark: false,
            colorScheme: 'light',
            setColorScheme: NOOP_SET_COLOR_SCHEME,
            isLoading: false,
        }),
        [],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

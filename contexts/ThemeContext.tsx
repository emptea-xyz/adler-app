/**
 * ThemeContext - Manages user's theme color and color scheme preferences.
 *
 * Two independent settings:
 * 1. Theme name (mono, red, blue, etc.) — controls the color palette
 * 2. Color scheme (system, light, dark) — controls light/dark appearance
 *
 * When dark mode is active, the palette is inverted (50↔950) so all
 * existing `theme[N]` usages automatically adapt.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';
import {
    ThemeName,
    ThemePalette,
    THEME_COLORS,
    DEFAULT_THEME,
    SIGNAL_COLORS,
    SIGNAL_PALETTE,
    invertPalette,
} from '@/constants/ThemePalettes';
export type ColorScheme = 'system' | 'light' | 'dark';
const DEFAULT_SCHEME: ColorScheme = 'system';

/**
 * Brand-accent slots whose color resolves from the active theme. Mono uses sky,
 * other themes use their own palette — see ThemeProvider.
 */
type ResolvedSignalColors = Omit<typeof SIGNAL_COLORS, 'action' | 'lp' | 'pr'> & {
    action: ThemePalette;
    lp: ThemePalette;
    pr: ThemePalette;
};

interface ThemeContextType {
    /** Current selected theme name */
    themeName: ThemeName;
    /** Resolved palette (inverted when dark mode is active) */
    theme: ThemePalette;
    /** Signal colors for contextual accents (action/lp/pr resolve per theme) */
    signalColors: ResolvedSignalColors;
    /** 8-color accent palette for charts, data series, and decorative elements */
    signalPalette: typeof SIGNAL_PALETTE;
    /** Whether the current appearance is dark */
    isDark: boolean;
    /** Current color scheme preference */
    colorScheme: ColorScheme;
    /** Change and persist the theme selection */
    setTheme: (name: ThemeName) => Promise<void>;
    /** Change and persist the color scheme */
    setColorScheme: (scheme: ColorScheme) => Promise<void>;
    /** Whether the context is still loading from storage */
    isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useSystemColorScheme();
    const [themeName, setThemeName] = useState<ThemeName>(DEFAULT_THEME);
    const [colorScheme, setColorSchemeState] = useState<ColorScheme>(DEFAULT_SCHEME);
    const [isLoading, setIsLoading] = useState(true);

    // Load cached preferences on mount
    useEffect(() => {
        const load = async () => {
            try {
                const [storedTheme, storedScheme] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.ACCENT_COLOR),
                    AsyncStorage.getItem(STORAGE_KEYS.COLOR_SCHEME),
                ]);

                if (storedTheme) {
                    // Migrate legacy obsidian users → mono + dark
                    if (storedTheme === 'obsidian') {
                        setThemeName('mono');
                        setColorSchemeState('dark');
                        await Promise.all([
                            AsyncStorage.setItem(STORAGE_KEYS.ACCENT_COLOR, 'mono'),
                            AsyncStorage.setItem(STORAGE_KEYS.COLOR_SCHEME, 'dark'),
                        ]);
                    } else if (storedTheme in THEME_COLORS) {
                        setThemeName(storedTheme as ThemeName);
                    }
                }

                if (storedScheme && ['system', 'light', 'dark'].includes(storedScheme)) {
                    // Skip scheme load if we just migrated from obsidian
                    if (storedTheme !== 'obsidian') {
                        setColorSchemeState(storedScheme as ColorScheme);
                    }
                }
            } catch (error) {
                if (__DEV__) console.warn('Failed to load theme preferences:', error);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const setTheme = useCallback(async (name: ThemeName) => {
        setThemeName(name);
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.ACCENT_COLOR, name);
        } catch (error) {
            if (__DEV__) console.error('Failed to save theme:', error);
        }
    }, []);

    const setColorScheme = useCallback(async (scheme: ColorScheme) => {
        setColorSchemeState(scheme);
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.COLOR_SCHEME, scheme);
        } catch (error) {
            if (__DEV__) console.error('Failed to save color scheme:', error);
        }
    }, []);

    const value = useMemo(() => {
        const effectiveTheme = themeName;
        const effectiveScheme = colorScheme;

        // Resolve whether we're in dark mode
        const isDark = effectiveScheme === 'system'
            ? systemScheme === 'dark'
            : effectiveScheme === 'dark';

        // Invert palette for dark mode
        const basePalette = THEME_COLORS[effectiveTheme];
        const theme = isDark ? invertPalette(basePalette) : basePalette;

        // Brand accent: sky-blue for mono, the theme's own palette otherwise.
        // Drives signalColors.lp/pr/action so per-theme branding stays consistent.
        const brandPalette =
            effectiveTheme === 'mono' ? SIGNAL_PALETTE.sky : THEME_COLORS[effectiveTheme];

        const signalColors = {
            ...SIGNAL_COLORS,
            action: brandPalette,
            lp: brandPalette,
            pr: brandPalette,
        };

        return {
            themeName: effectiveTheme,
            theme,
            signalColors,
            signalPalette: SIGNAL_PALETTE,
            isDark,
            colorScheme: effectiveScheme,
            setTheme,
            setColorScheme,
            isLoading,
        };
    }, [themeName, colorScheme, systemScheme, setTheme, setColorScheme, isLoading]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

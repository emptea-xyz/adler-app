/**
 * ThemeContext — single mono palette, light/dark inverted at render time.
 *
 * The user can pick `system | light | dark`. Multi-accent theming is
 * intentionally not exposed; if we ever want it back, restore from git.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';
import {
    ThemePalette,
    MONO_PALETTE,
    SIGNAL_COLORS,
    SIGNAL_PALETTE,
    invertPalette,
} from '@/constants/ThemePalettes';

export type ColorScheme = 'system' | 'light' | 'dark';
const DEFAULT_SCHEME: ColorScheme = 'system';

interface ThemeContextType {
    /** Resolved palette (inverted when dark mode is active) */
    theme: ThemePalette;
    /** Static signal colors (accent + ramp) */
    signalColors: typeof SIGNAL_COLORS;
    /** Reusable Tailwind-sourced accent palette */
    signalPalette: typeof SIGNAL_PALETTE;
    /** Whether the current appearance is dark */
    isDark: boolean;
    /** Current color scheme preference */
    colorScheme: ColorScheme;
    /** Change and persist the color scheme */
    setColorScheme: (scheme: ColorScheme) => Promise<void>;
    /** Whether the context is still loading from storage */
    isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useSystemColorScheme();
    const [colorScheme, setColorSchemeState] = useState<ColorScheme>(DEFAULT_SCHEME);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEYS.COLOR_SCHEME);
                if (stored && ['system', 'light', 'dark'].includes(stored)) {
                    setColorSchemeState(stored as ColorScheme);
                }
            } catch (err) {
                if (__DEV__) console.warn('Failed to load color scheme:', err);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const setColorScheme = useCallback(async (scheme: ColorScheme) => {
        setColorSchemeState(scheme);
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.COLOR_SCHEME, scheme);
        } catch (err) {
            if (__DEV__) console.error('Failed to save color scheme:', err);
        }
    }, []);

    const value = useMemo<ThemeContextType>(() => {
        const isDark = colorScheme === 'system'
            ? systemScheme === 'dark'
            : colorScheme === 'dark';

        const theme = isDark ? invertPalette(MONO_PALETTE) : MONO_PALETTE;

        return {
            theme,
            signalColors: SIGNAL_COLORS,
            signalPalette: SIGNAL_PALETTE,
            isDark,
            colorScheme,
            setColorScheme,
            isLoading,
        };
    }, [colorScheme, systemScheme, setColorScheme, isLoading]);

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

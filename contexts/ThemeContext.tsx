/**
 * ThemeContext — system-aware light/dark mode.
 *
 * Re-enabled on 2026-05-13. `theme` flips between MONO_PALETTE and
 * DARK_MONO_PALETTE; `tw` is a mode-aware Tailwind accessor that mirrors
 * shades across the 500 axis in dark mode (sky[50] → sky[950], etc.).
 *
 * The user override is persisted to AsyncStorage under
 * STORAGE_KEYS.COLOR_SCHEME and falls back to the system color scheme
 * when unset or explicitly set to `'system'`.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    DARK_MONO_PALETTE,
    MONO_PALETTE,
    SIGNAL_COLORS,
    ThemePalette,
} from '@/constants/ThemePalettes';
import {
    TailwindColors,
    buildModeAwareTailwind,
} from '@/constants/TailwindColors';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';

type ColorScheme = 'system' | 'light' | 'dark';
type ResolvedScheme = 'light' | 'dark';

interface ThemeContextType {
    /** Mode-aware mono palette. theme[50]↔theme[950] flip in dark mode. */
    theme: ThemePalette;
    /** Mode-aware Tailwind palettes. tw.sky[50] returns sky[950] in dark mode. */
    tw: typeof TailwindColors;
    /** Static signal colors (accent only, never inverts). */
    signalColors: typeof SIGNAL_COLORS;
    /** `true` if the resolved scheme is `'dark'`. */
    isDark: boolean;
    /** User preference: `'system' | 'light' | 'dark'`. */
    colorScheme: ColorScheme;
    /** Set + persist the user preference. */
    setColorScheme: (scheme: ColorScheme) => Promise<void>;
    /** `true` until the persisted preference has loaded from AsyncStorage. */
    isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function resolveScheme(pref: ColorScheme, system: ResolvedScheme): ResolvedScheme {
    if (pref === 'light' || pref === 'dark') return pref;
    return system;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [pref, setPref] = useState<ColorScheme>('system');
    const [systemScheme, setSystemScheme] = useState<ResolvedScheme>(
        Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
    );
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEYS.COLOR_SCHEME);
                if (!cancelled && (raw === 'light' || raw === 'dark' || raw === 'system')) {
                    setPref(raw);
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const sub = Appearance.addChangeListener(({ colorScheme }) => {
            setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
        });
        return () => sub.remove();
    }, []);

    const resolved = resolveScheme(pref, systemScheme);
    const isDark = resolved === 'dark';

    const value = useMemo<ThemeContextType>(
        () => ({
            theme: isDark ? DARK_MONO_PALETTE : MONO_PALETTE,
            tw: buildModeAwareTailwind(isDark),
            signalColors: SIGNAL_COLORS,
            isDark,
            colorScheme: pref,
            setColorScheme: async (next: ColorScheme) => {
                setPref(next);
                await AsyncStorage.setItem(STORAGE_KEYS.COLOR_SCHEME, next);
            },
            isLoading,
        }),
        [isDark, pref, isLoading],
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

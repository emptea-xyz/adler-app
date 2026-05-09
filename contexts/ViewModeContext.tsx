import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Reanimated from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';
import type { ViewMode } from '@/lib/types/profile';
import { useUser } from '@/contexts/UserContext';

interface ViewModeContextType {
    viewMode: ViewMode;
    availableModes: ViewMode[];
    setViewMode: (mode: ViewMode) => Promise<void>;
    isTransitioning: SharedValue<boolean>;
}

const ViewModeContext = createContext<ViewModeContextType | null>(null);

function modesForProfile(isCreator?: boolean, isBrand?: boolean): ViewMode[] {
    if (isCreator && isBrand) return ['creator', 'brand'];
    if (isCreator) return ['creator'];
    if (isBrand) return ['brand'];
    return ['creator', 'brand'];
}

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
    const { profile } = useUser();
    const availableModes = useMemo(
        () => modesForProfile(profile?.isCreator, profile?.isBrand),
        [profile?.isCreator, profile?.isBrand],
    );
    const [viewMode, setViewModeState] = useState<ViewMode>('creator');
    const isTransitioning = Reanimated.useSharedValue(false);

    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(STORAGE_KEYS.VIEW_MODE)
            .then((stored) => {
                if (cancelled) return;
                if (stored === 'creator' || stored === 'brand') {
                    setViewModeState(stored);
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!availableModes.includes(viewMode)) {
            const next = availableModes[0] ?? 'creator';
            setViewModeState(next);
            AsyncStorage.setItem(STORAGE_KEYS.VIEW_MODE, next).catch(() => {});
        }
    }, [availableModes, viewMode]);

    const setViewMode = useCallback(
        async (mode: ViewMode) => {
            if (!availableModes.includes(mode)) return;
            isTransitioning.value = true;
            setViewModeState(mode);
            await AsyncStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode).catch(() => {});
            setTimeout(() => {
                isTransitioning.value = false;
            }, 300);
        },
        [availableModes, isTransitioning],
    );

    const value = useMemo(
        () => ({ viewMode, availableModes, setViewMode, isTransitioning }),
        [viewMode, availableModes, setViewMode, isTransitioning],
    );

    return (
        <ViewModeContext.Provider value={value}>
            {children}
        </ViewModeContext.Provider>
    );
}

export function useViewMode(): ViewModeContextType {
    const ctx = useContext(ViewModeContext);
    if (!ctx) throw new Error('useViewMode must be used within a ViewModeProvider');
    return ctx;
}

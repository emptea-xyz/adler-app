import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { ensureProfileExists, getProfile } from '@/lib/services/profileService';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';
import type { Profile } from '@/types/marketplace';

interface UserContextType {
    profile: Profile | null;
    loading: boolean;
    hasRole: boolean;
    refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const { user, walletAddress, isBridging } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // SWR: serve cached profile immediately, then revalidate.
    useEffect(() => {
        if (!user) {
            setProfile(null);
            setLoading(false);
            AsyncStorage.removeItem(STORAGE_KEYS.CACHED_PROFILE).catch(() => {});
            return;
        }

        (async () => {
            try {
                const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_PROFILE);
                if (cached) {
                    const parsed = JSON.parse(cached) as Profile;
                    if (parsed.id === user.id && isMounted.current) {
                        setProfile(parsed);
                    }
                }
            } catch {
                // Stale cache is fine — fall through to network fetch.
            } finally {
                if (isMounted.current) setLoading(false);
            }
        })();
    }, [user]);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        try {
            // First-login bootstrap: ensure a profile doc exists. Wallet address may
            // arrive a moment after the Firebase user (Privy creates it lazily).
            const ensured = await ensureProfileExists(user.id, walletAddress);
            if (!isMounted.current) return;
            setProfile(ensured);
            AsyncStorage.setItem(STORAGE_KEYS.CACHED_PROFILE, JSON.stringify(ensured)).catch(() => {});
        } catch (err) {
            console.error('Failed to fetch profile:', err);
            // Soft fallback to whatever is on disk.
            try {
                const fresh = await getProfile(user.id);
                if (fresh && isMounted.current) {
                    setProfile(fresh);
                    AsyncStorage.setItem(STORAGE_KEYS.CACHED_PROFILE, JSON.stringify(fresh)).catch(() => {});
                }
            } catch (innerErr) {
                console.error('Profile fallback fetch failed:', innerErr);
            }
        }
    }, [user, walletAddress]);

    // Revalidate whenever auth state settles or wallet address arrives.
    useEffect(() => {
        if (!user || isBridging) return;
        fetchProfile();
    }, [user, walletAddress, isBridging, fetchProfile]);

    const value = useMemo<UserContextType>(
        () => ({
            profile,
            loading,
            hasRole: !!profile?.role,
            refreshProfile: fetchProfile,
        }),
        [profile, loading, fetchProfile],
    );

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextType {
    const ctx = useContext(UserContext);
    if (!ctx) throw new Error('useUser must be used within a UserProvider');
    return ctx;
}

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { ensureProfileExists, getProfile, setPushToken } from '@/lib/services/profileService';
import {
    addPushTokenRotationListener,
    getPushPermissionState,
    registerForPushAsync,
} from '@/lib/services/pushService';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';
import type { Profile } from '@/types/marketplace';
import { viewModeFor } from '@/lib/utils/role';
import { PushPermissionPrompt } from '@/components/features/notifications/PushPermissionPrompt';
import { toast } from '@/lib/utils/toast';

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
    const [pushPromptVisible, setPushPromptVisible] = useState(false);
    const [pushPromptLoading, setPushPromptLoading] = useState(false);
    const isMounted = useRef(true);
    // Per-app-launch latch so we register for push at most once per user even
    // if profile fetches re-fire (wallet arrives, refresh on focus, etc.).
    const pushSyncedFor = useRef<string | null>(null);

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
            pushSyncedFor.current = null;
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

            // Register silently when the user already granted iOS permission.
            // If permission is still undetermined, show Adler's pre-prompt first.
            if (pushSyncedFor.current !== user.id) {
                pushSyncedFor.current = user.id;
                getPushPermissionState()
                    .then(async (permission) => {
                        if (permission === 'granted') {
                            const token = await registerForPushAsync({ requestPermission: false });
                            if (!token || token === ensured.pushToken) return;
                            await setPushToken(user.id, token);
                            return;
                        }
                        if (permission !== 'undetermined') return;
                        const seen = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_PREPROMPT_SEEN);
                        if (!seen && isMounted.current) setPushPromptVisible(true);
                    })
                    .catch((err) => {
                        if (__DEV__) console.warn('Push permission check failed', err);
                    });
            }
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

    useEffect(() => {
        if (!user) return;
        const sub = addPushTokenRotationListener((token) => {
            setPushToken(user.id, token).catch((err) => {
                if (__DEV__) console.warn('Push token rotation sync failed', err);
            });
        });
        return () => sub.remove();
    }, [user]);

    const dismissPushPrompt = useCallback(async () => {
        await AsyncStorage.setItem(STORAGE_KEYS.PUSH_PREPROMPT_SEEN, 'true').catch(() => {});
        if (isMounted.current) setPushPromptVisible(false);
    }, []);

    const enablePush = useCallback(async () => {
        if (!user) return;
        setPushPromptLoading(true);
        try {
            const token = await registerForPushAsync({ requestPermission: true });
            await AsyncStorage.setItem(STORAGE_KEYS.PUSH_PREPROMPT_SEEN, 'true').catch(() => {});
            if (token) {
                await setPushToken(user.id, token);
                await fetchProfile();
            } else {
                toast.info('Notifications can be enabled later in Settings.');
            }
            if (isMounted.current) setPushPromptVisible(false);
        } catch (err) {
            if (__DEV__) console.warn('Push opt-in failed', err);
            toast.error('Notification setup failed.');
        } finally {
            if (isMounted.current) setPushPromptLoading(false);
        }
    }, [fetchProfile, user]);

    const value = useMemo<UserContextType>(
        () => ({
            profile,
            loading,
            hasRole: viewModeFor(profile) !== null,
            refreshProfile: fetchProfile,
        }),
        [profile, loading, fetchProfile],
    );

    return (
        <UserContext.Provider value={value}>
            {children}
            <PushPermissionPrompt
                visible={pushPromptVisible}
                loading={pushPromptLoading}
                onEnable={enablePush}
                onSkip={dismissPushPrompt}
            />
        </UserContext.Provider>
    );
}

export function useUser(): UserContextType {
    const ctx = useContext(UserContext);
    if (!ctx) throw new Error('useUser must be used within a UserProvider');
    return ctx;
}

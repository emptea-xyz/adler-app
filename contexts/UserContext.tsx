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
import type { Profile } from '@/lib/types/profile';
import { PushPermissionPrompt } from '@/components/features/notifications/PushPermissionPrompt';
import { toast } from '@/lib/utils/toast';
import { DEMO_MODE } from '@/lib/mock';
import { DEMO_PROFILE } from '@/lib/mock/fixtures';

interface UserContextType {
    profile: Profile | null;
    loading: boolean;
    refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
    if (DEMO_MODE) {
        return <DemoUserProvider>{children}</DemoUserProvider>;
    }
    return <RealUserProvider>{children}</RealUserProvider>;
}

function RealUserProvider({ children }: { children: React.ReactNode }) {
    const { user, walletAddress, isBridging } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [pushPromptVisible, setPushPromptVisible] = useState(false);
    const [pushPromptLoading, setPushPromptLoading] = useState(false);
    const isMounted = useRef(true);
    const pushSyncedFor = useRef<string | null>(null);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

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
            const ensured = await ensureProfileExists(user.id, walletAddress);
            if (!isMounted.current) return;
            setProfile(ensured);
            AsyncStorage.setItem(STORAGE_KEYS.CACHED_PROFILE, JSON.stringify(ensured)).catch(() => {});

            if (pushSyncedFor.current !== user.id) {
                // M13: claim the slot synchronously to dedup parallel
                // fetchProfile fires within the same user.id; reset on
                // error so the next mount can retry instead of silently
                // skipping forever.
                pushSyncedFor.current = user.id;
                getPushPermissionState()
                    .then(async (permission) => {
                        if (permission === 'granted') {
                            const token = await registerForPushAsync({ requestPermission: false });
                            if (!token) return;
                            await setPushToken(user.id, token);
                            return;
                        }
                        if (permission !== 'undetermined') return;
                        const seen = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_PREPROMPT_SEEN);
                        if (!seen && isMounted.current) setPushPromptVisible(true);
                    })
                    .catch((err) => {
                        if (__DEV__) console.warn('Push permission check failed', err);
                        pushSyncedFor.current = null;
                    });
            }
        } catch (err) {
            if (__DEV__) console.error('Failed to fetch profile:', err);
            try {
                const fresh = await getProfile(user.id);
                if (fresh && isMounted.current) {
                    setProfile(fresh);
                    AsyncStorage.setItem(STORAGE_KEYS.CACHED_PROFILE, JSON.stringify(fresh)).catch(() => {});
                }
            } catch (innerErr) {
                if (__DEV__) console.error('Profile fallback fetch failed:', innerErr);
            }
        }
    }, [user, walletAddress]);

    useEffect(() => {
        if (!user || isBridging) return;
        fetchProfile();
    }, [user, walletAddress, isBridging, fetchProfile]);

    useEffect(() => {
        if (!user) return;
        // L6: capture uid into a local const so a mid-callback `user`
        // mutation (TS narrowing) can't crash on `user.id`. The effect
        // cleanup also runs before user changes — so this is largely
        // defensive but cheap.
        const uid = user.id;
        const sub = addPushTokenRotationListener((token) => {
            setPushToken(uid, token).catch((err) => {
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

function DemoUserProvider({ children }: { children: React.ReactNode }) {
    const value = useMemo<UserContextType>(
        () => ({
            profile: DEMO_PROFILE,
            loading: false,
            refreshProfile: async () => {},
        }),
        [],
    );
    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

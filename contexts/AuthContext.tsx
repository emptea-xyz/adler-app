import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { usePrivy, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { useNetInfo } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase/config';
import { bridgeToFirebase, signOutOfFirebase } from '@/lib/services/privyAuthService';
import { clearPushToken } from '@/lib/services/profileService';
import { toast } from '@/lib/utils/toast';
import { InitialLoadingScreen } from '@/components/base/InitialLoadingScreen';

export interface AuthUser {
    id: string;
    email?: string | null;
}

interface AuthContextType {
    user: AuthUser | null;
    privyUserId: string | null;
    walletAddress: string | null;
    isReady: boolean;
    isBridging: boolean;
    isConnected: boolean;
    signOut: () => Promise<void>;
    runIfOnline: (callback: () => void) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function toAuthUser(fbUser: FirebaseUser | null): AuthUser | null {
    if (!fbUser) return null;
    return { id: fbUser.uid, email: fbUser.email };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { user: privyUser, isReady: privyReady, getAccessToken, logout: privyLogout } = usePrivy();
    const solana = useEmbeddedSolanaWallet();
    const queryClient = useQueryClient();

    const [firebaseUser, setFirebaseUser] = useState<AuthUser | null>(toAuthUser(auth.currentUser));
    const [bridging, setBridging] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const isMounted = useRef(true);
    const lastBridgedPrivyId = useRef<string | null>(null);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Firebase auth listener — single source of truth for the canonical user.
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (fb) => {
            if (!isMounted.current) return;
            setFirebaseUser(toAuthUser(fb));
            if (!fb) lastBridgedPrivyId.current = null;
        });
        return unsub;
    }, []);

    // Bridge Privy → Firebase whenever the Privy user changes. Read the id
    // once so the effect depends on a stable string, not the privyUser object
    // identity (which can churn on every Privy render).
    const privyUserId = privyUser?.id ?? null;
    useEffect(() => {
        if (!privyReady) return;

        if (!privyUserId) {
            // Privy logged out → mirror in Firebase.
            if (auth.currentUser) {
                signOutOfFirebase().catch(() => {});
            }
            return;
        }

        if (lastBridgedPrivyId.current === privyUserId && auth.currentUser) {
            return;
        }

        let cancelled = false;
        (async () => {
            setBridging(true);
            try {
                const token = await getAccessToken();
                if (!token) throw new Error('No Privy access token available');
                await bridgeToFirebase(token);
                lastBridgedPrivyId.current = privyUserId;
            } catch (err) {
                if (!cancelled) {
                    if (__DEV__) console.error('Failed to bridge Privy→Firebase:', err);
                    toast.error('Sign-in failed. Please try again.');
                    // privyLogout can itself throw; fall back to clearing the
                    // Firebase session so the user lands on sign-in instead of
                    // a stuck "bridging" screen.
                    try {
                        await privyLogout();
                    } catch {
                        await signOutOfFirebase().catch(() => {});
                    }
                }
            } finally {
                if (!cancelled && isMounted.current) {
                    setBridging(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [privyReady, privyUserId, getAccessToken, privyLogout]);

    const signOut = useCallback(async () => {
        try {
            // Clear the push token *before* sign-out so the write still passes
            // the owner-rule check. Best-effort — a failed write doesn't block
            // sign-out (the user still wants to leave).
            const currentUid = auth.currentUser?.uid;
            if (currentUid) {
                // L5: best-effort but visible in dev; a silent failure
                // here meant rule-tightening regressions slipped through.
                await clearPushToken(currentUid).catch((err) => {
                    if (__DEV__) console.warn('clearPushToken failed', err);
                });
            }
            await privyLogout();
            await signOutOfFirebase();
            queryClient.clear();
        } catch (err) {
            if (__DEV__) console.error('Sign-out failed:', err);
            toast.error('Sign-out failed. Please try again.');
        }
    }, [privyLogout, queryClient]);

    // Debounced network state.
    const netInfo = useNetInfo();
    const [isConnected, setIsConnected] = useState(true);
    const netDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        const newValue = !!(netInfo.isConnected && netInfo.isInternetReachable !== false);
        if (newValue === isConnected) return;
        clearTimeout(netDebounceRef.current);
        netDebounceRef.current = setTimeout(() => {
            if (isMounted.current) setIsConnected(newValue);
        }, 300);
        return () => clearTimeout(netDebounceRef.current);
    }, [netInfo.isConnected, netInfo.isInternetReachable, isConnected]);

    const runIfOnline = useCallback(
        (callback: () => void) => {
            if (!isConnected) {
                toast.error('You are offline. This action is disabled.');
                return;
            }
            callback();
        },
        [isConnected],
    );

    const walletAddress = useMemo(() => {
        return solana.wallets?.[0]?.address ?? null;
    }, [solana.wallets]);

    const value = useMemo<AuthContextType>(
        () => ({
            user: firebaseUser,
            privyUserId,
            walletAddress,
            isReady: privyReady,
            isBridging: bridging,
            isConnected,
            signOut,
            runIfOnline,
        }),
        [firebaseUser, privyUserId, walletAddress, privyReady, bridging, isConnected, signOut, runIfOnline],
    );

    // Keep children mounted underneath the loader so the loader's fade-out
    // cross-fades into the next screen — otherwise children mount fresh on
    // unmount and any static content (e.g. the sign-in eagle) pops in abruptly.
    return (
        <AuthContext.Provider value={value}>
            {children}
            {initialLoading && (
                <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
                    <InitialLoadingScreen onLoadingComplete={() => setInitialLoading(false)} />
                </View>
            )}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}

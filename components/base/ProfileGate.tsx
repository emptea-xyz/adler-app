import React from 'react';
import { Redirect } from 'expo-router';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { useUser } from '@/contexts/UserContext';

interface ProfileGateProps {
    children: React.ReactNode;
}

/**
 * Thin gate: in v1 (bounty) every authenticated user can use the app.
 * The component still exists so future surfaces (group-admin panel) can
 * extend it with capability checks without a tree refactor.
 */
export function ProfileGate({ children }: ProfileGateProps) {
    const { profile, loading } = useUser();

    if (loading) return <LoadingScreen />;
    if (!profile) return <Redirect href="/(auth)/sign-in" />;

    return <>{children}</>;
}

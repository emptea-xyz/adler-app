import React from 'react';
import { Redirect } from 'expo-router';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { useUser } from '@/contexts/UserContext';
import type { ViewMode } from '@/lib/types/profile';

type ProfileGateRequire = 'both' | ViewMode;

interface ProfileGateProps {
    require?: ProfileGateRequire;
    children: React.ReactNode;
}

function profileSatisfies(require: ProfileGateRequire, isCreator: boolean, isBrand: boolean): boolean {
    if (require === 'both') return isCreator && isBrand;
    if (require === 'creator') return isCreator;
    return isBrand;
}

export function ProfileGate({ require = 'both', children }: ProfileGateProps) {
    const { profile, loading } = useUser();

    if (loading) return <LoadingScreen />;

    const isCreator = profile?.isCreator === true;
    const isBrand = profile?.isBrand === true;

    if (!profileSatisfies(require, isCreator, isBrand)) {
        return <Redirect href="/(auth)/onboarding/basics" />;
    }

    return <>{children}</>;
}

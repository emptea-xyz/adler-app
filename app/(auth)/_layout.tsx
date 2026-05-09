import React, { useEffect, useState } from 'react';
import { Stack, Redirect, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';

/**
 * Routing rules for the (auth) group:
 * - No user yet → stay on sign-in (default)
 * - User authed but missing either side → stay in onboarding
 * - User authed with both sides → bounce out of (auth) entirely to /(home)
 */
export default function AuthLayout() {
  const { user, isReady, isBridging } = useAuth();
  const { profile, loading } = useUser();
  const segments = useSegments() as string[];
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_SEEN)
      .then((value) => setSeenOnboarding(value === 'true'))
      .catch(() => setSeenOnboarding(true));
  }, []);

  if (isReady && !isBridging && user && !loading) {
    if (profile?.isCreator && profile?.isBrand) {
      return <Redirect href="/(home)/(tabs)/browse" />;
    }
    if (segments[1] !== 'onboarding') {
      if (seenOnboarding === null) return <LoadingScreen />;
      return (
        <Redirect
          href={seenOnboarding ? '/(auth)/onboarding/basics' : '/(auth)/onboarding/intro'}
        />
      );
    }
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="onboarding/intro" />
      <Stack.Screen name="onboarding/basics" />
      <Stack.Screen name="onboarding/creator" />
      <Stack.Screen name="onboarding/brand" />
    </Stack>
  );
}

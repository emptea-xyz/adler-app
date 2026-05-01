import React from 'react';
import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';

/**
 * Routing rules for the (auth) group:
 * - No user yet → stay on sign-in (default)
 * - User authed but no role yet → bounce to role-select (unless already there)
 * - User authed with a role → bounce out of (auth) entirely to /(home)
 */
export default function AuthLayout() {
  const { user, isReady, isBridging } = useAuth();
  const { profile, loading } = useUser();
  const segments = useSegments();

  if (isReady && !isBridging && user && !loading) {
    if (profile?.role) {
      return <Redirect href="/(home)/(tabs)/browse" />;
    }
    // segments[1] is the screen name within the (auth) group
    if (segments[1] !== 'role-select') {
      return <Redirect href="/(auth)/role-select" />;
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
      <Stack.Screen name="role-select" />
    </Stack>
  );
}

import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';

/**
 * Auth group:
 *  - No user           → stay on sign-in
 *  - User signed in    → bounce to /(home)
 */
export default function AuthLayout() {
  const { user, isReady, isBridging } = useAuth();
  const { loading } = useUser();

  if (isReady && !isBridging && user && !loading) {
    return <Redirect href="/(home)/(tabs)/browse" />;
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
    </Stack>
  );
}

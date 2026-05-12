import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { OverlaySheetsProvider } from '@/contexts/OverlaySheetsContext';

export default function HomeLayout() {
  const { user, isReady, isBridging } = useAuth();
  const { loading } = useUser();

  if (!isReady || isBridging || loading) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;

  return (
    <OverlaySheetsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="bounty/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="bounty/[id]/submit" options={{ presentation: 'card' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="wallet/activity" options={{ presentation: 'card' }} />
        <Stack.Screen name="leaderboard" options={{ presentation: 'card' }} />
      </Stack>
    </OverlaySheetsProvider>
  );
}

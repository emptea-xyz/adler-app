import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { OverlaySheetsProvider } from '@/contexts/OverlaySheetsContext';
import { ProfileGate } from '@/components/base/ProfileGate';

export default function HomeLayout() {
  const { user, isReady, isBridging } = useAuth();
  const { loading } = useUser();

  if (!isReady || isBridging || loading) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;

  return (
    <ProfileGate require="both">
      <OverlaySheetsProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="service/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="services/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="services/[id]/edit" options={{ presentation: 'card' }} />
          <Stack.Screen name="gig/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="gigs/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="gigs/[id]/edit" options={{ presentation: 'card' }} />
          <Stack.Screen name="gigs/new" options={{ presentation: 'card' }} />
          <Stack.Screen name="checkout" options={{ presentation: 'modal' }} />
          <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="profile/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="settings" />
        </Stack>
      </OverlaySheetsProvider>
    </ProfileGate>
  );
}

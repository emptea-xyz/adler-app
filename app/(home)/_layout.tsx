import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { LoadingScreen } from '@/components/base/LoadingScreen';

export default function HomeLayout() {
  const { user, isReady, isBridging } = useAuth();
  const { profile, loading } = useUser();

  if (!isReady || isBridging || loading) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (!profile?.role) return <Redirect href="/(auth)/role-select" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="package/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="gig/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="checkout" options={{ presentation: 'modal' }} />
      <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

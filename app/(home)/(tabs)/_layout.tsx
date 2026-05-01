import React from 'react';
import { Tabs } from 'expo-router';
import { AdlerTabBar } from '@/components/ui/AdlerTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AdlerTabBar {...props} />}
    >
      <Tabs.Screen name="browse" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

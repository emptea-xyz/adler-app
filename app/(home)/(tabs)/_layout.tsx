import React from 'react';
import { Tabs } from 'expo-router';
import { AdlerTabBar } from '@/components/ui/AdlerTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Allow the centered FAB in AdlerTabBar to overflow above the bar.
        tabBarStyle: { borderTopWidth: 0, elevation: 0, overflow: 'visible' },
      }}
      tabBar={(props) => <AdlerTabBar {...props} />}
    >
      <Tabs.Screen name="browse" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="wallet" />
    </Tabs>
  );
}

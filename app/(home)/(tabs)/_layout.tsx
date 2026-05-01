import React from 'react';
import { Tabs } from 'expo-router';
import { Compass, Inbox, Plus, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme[950],
        tabBarInactiveTintColor: theme[400],
        tabBarStyle: {
          backgroundColor: theme[50],
          borderTopColor: theme[200],
        },
        tabBarLabelStyle: {
          fontFamily: 'Geist_400Regular',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color, size }) => <Plus color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

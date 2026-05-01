import React, { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { setRole } from '@/lib/services/profileService';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import type { UserRole } from '@/types/marketplace';

const ROLES: { id: UserRole; title: string; description: string }[] = [
  {
    id: 'creator',
    title: 'I\'m a creator',
    description: 'Sell content packages and apply to brand gigs.',
  },
  {
    id: 'brand',
    title: 'I\'m a brand',
    description: 'Buy packages and post gigs for creators to apply to.',
  },
];

export default function RoleSelectScreen() {
  const { user } = useAuth();
  const { refreshProfile } = useUser();
  const { theme } = useTheme();
  const router = useRouter();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onConfirm = useCallback(async () => {
    if (!user || !selected) return;
    setSubmitting(true);
    try {
      await setRole(user.id, selected);
      await refreshProfile();
      router.replace('/(home)/(tabs)/browse');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to set role');
      setSubmitting(false);
    }
  }, [user, selected, refreshProfile, router]);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-6 pt-12 pb-8 justify-between">
          <View>
            <ThemedText type="h2" className="tracking-tight">
              Pick your role
            </ThemedText>
            <ThemedText type="body-md" className="mt-2" style={{ color: theme[500] }}>
              You can switch later in Settings.
            </ThemedText>
          </View>

          <View className="gap-3">
            {ROLES.map((r) => {
              const isActive = selected === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    haptic('light');
                    setSelected(r.id);
                  }}
                  className="rounded-card p-4 border-2"
                  style={{
                    borderColor: isActive ? theme[950] : theme[200],
                    backgroundColor: isActive ? theme[100] : 'transparent',
                  }}
                >
                  <ThemedText type="body-lg-semibold">{r.title}</ThemedText>
                  <ThemedText type="body-sm" className="mt-1" style={{ color: theme[500] }}>
                    {r.description}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Button
            title="Continue"
            onPress={onConfirm}
            disabled={!selected || submitting}
            loading={submitting}
            variant="primary"
            size="lg"
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

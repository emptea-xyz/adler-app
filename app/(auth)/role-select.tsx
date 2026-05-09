import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import { RoleSelectCard } from '@/components/ui/RoleSelectCard';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  updateBrandProfile,
  updateCreatorProfile,
} from '@/lib/services/profileService';
import { toast } from '@/lib/utils/toast';
import type { UserRole } from '@/types/marketplace';

const ROLES: { id: UserRole; title: string; description: string }[] = [
  {
    id: 'creator',
    title: "I'm a creator",
    description: 'Sell content packages and apply to brand gigs.',
  },
  {
    id: 'brand',
    title: "I'm a brand",
    description: 'Buy packages and post gigs for creators to apply to.',
  },
];

export default function RoleSelectScreen() {
  const { user } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { theme } = useTheme();
  const router = useRouter();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onConfirm = useCallback(async () => {
    if (!user || !selected) return;
    setSubmitting(true);
    try {
      // v1 supports both sides on the same account; "picking" a role here
      // just sets up that side's empty sub-profile so the user lands in a
      // valid state. Step 2 deletes this screen entirely and uses
      // ProfileGate to gate role-specific routes instead.
      if (selected === 'creator') {
        await updateCreatorProfile(user.id, {});
      } else {
        // BrandProfile.companyName is required by the rule; default to
        // displayName so the create succeeds without forcing extra UI here.
        await updateBrandProfile(user.id, {
          companyName: profile?.displayName || profile?.username || 'Brand',
        });
      }
      await refreshProfile();
      router.replace('/(home)/(tabs)/browse');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to set role');
      setSubmitting(false);
    }
  }, [user, selected, profile, refreshProfile, router]);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-4 justify-between" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <View style={{ gap: 8 }}>
            <ThemedText type="h2" style={{ color: theme[950] }}>
              Pick your role
            </ThemedText>
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              You can switch later in Settings.
            </ThemedText>
          </View>

          <View style={{ gap: 16 }}>
            {ROLES.map((r) => (
              <RoleSelectCard
                key={r.id}
                title={r.title}
                description={r.description}
                selected={selected === r.id}
                onPress={() => setSelected(r.id)}
              />
            ))}
          </View>

          <Button
            title="Continue"
            onPress={onConfirm}
            disabled={!selected || submitting}
            loading={submitting}
            variant="primary"
            size="lg"
            className="w-full"
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

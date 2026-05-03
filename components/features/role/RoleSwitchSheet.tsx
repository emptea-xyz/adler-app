import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import { RoleSelectCard } from '@/components/ui/RoleSelectCard';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { setRole } from '@/lib/services/profileService';
import { toast } from '@/lib/utils/toast';
import type { UserRole } from '@/types/marketplace';

const ROLES: { id: UserRole; title: string; description: string }[] = [
  { id: 'creator', title: 'Creator', description: 'Sell content packages, apply to gigs.' },
  { id: 'brand', title: 'Brand', description: 'Buy packages, post gigs.' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function RoleSwitchSheet({ visible, onClose }: Props) {
  const { user } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { theme } = useTheme();
  const [selected, setSelected] = useState<UserRole | null>(profile?.role ?? null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelected(profile?.role ?? null);
      setSubmitting(false);
    }
  }, [visible, profile?.role]);

  const onConfirm = useCallback(
    async (closeFn: () => void) => {
      if (!user || !selected || selected === profile?.role) return;
      setSubmitting(true);
      try {
        await setRole(user.id, selected);
        await refreshProfile();
        toast.success('Role updated');
        closeFn();
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to update role');
        setSubmitting(false);
      }
    },
    [user, selected, profile?.role, refreshProfile],
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Switch role" height={440}>
      {({ close }) => (
        <View style={{ gap: 16 }}>
          <ThemedText type="body-sm" style={{ color: theme[500] }}>
            Switching role changes which tabs and flows you see. Your wallet, listings, and history stay intact.
          </ThemedText>
          <View style={{ gap: 12 }}>
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
            title="Save"
            onPress={() => onConfirm(close)}
            disabled={!selected || selected === profile?.role || submitting}
            loading={submitting}
            variant="primary"
            size="lg"
            className="w-full"
          />
        </View>
      )}
    </BottomSheet>
  );
}

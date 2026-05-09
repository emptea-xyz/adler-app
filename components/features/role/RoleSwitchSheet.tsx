import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
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
import { viewModeFor } from '@/lib/utils/role';
import type { UserRole } from '@/types/marketplace';

// v1 supports both creator and brand sides on the same account. The "switch
// role" idiom is a step-1 compat affordance: picking a side here ensures
// that side has at least an empty sub-profile so directory queries return
// the user. Step 2 replaces this sheet with the ProfileGate + the full
// settings/profile screen, where each side can be filled in or cleared.
const ROLES: { id: UserRole; title: string; description: string }[] = [
  { id: 'creator', title: 'Creator', description: 'Sell content services, apply to gigs.' },
  { id: 'brand', title: 'Brand', description: 'Buy services, post gigs.' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function RoleSwitchSheet({ visible, onClose }: Props) {
  const { user } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { theme } = useTheme();

  const currentRole = viewModeFor(profile);
  const [selected, setSelected] = useState<UserRole | null>(currentRole);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelected(currentRole);
      setSubmitting(false);
    }
  }, [visible, currentRole]);

  const onConfirm = useCallback(
    async (closeFn: () => void) => {
      if (!user || !selected || !profile) return;
      const alreadySetUp =
        (selected === 'creator' && profile.isCreator) ||
        (selected === 'brand' && profile.isBrand);
      if (alreadySetUp) {
        closeFn();
        return;
      }
      setSubmitting(true);
      try {
        if (selected === 'creator') {
          await updateCreatorProfile(user.id, {});
        } else {
          // BrandProfile requires `companyName`; default to displayName so
          // the rule passes without forcing extra UI here. Step 3's full
          // settings screen lets the user edit it properly.
          await updateBrandProfile(user.id, {
            companyName: profile.displayName || profile.username,
          });
        }
        await refreshProfile();
        toast.success(`${selected === 'creator' ? 'Creator' : 'Brand'} side enabled`);
        closeFn();
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to update profile');
        setSubmitting(false);
      }
    },
    [user, selected, profile, refreshProfile],
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Set up role" height={460}>
      {({ close }) => (
        <View style={{ gap: 16 }}>
          <ThemedText type="body-sm" style={{ color: theme[500] }}>
            Pick a side to set up. You can keep both — the directory shows you on whichever sides you fill in.
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
            disabled={!selected || submitting}
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

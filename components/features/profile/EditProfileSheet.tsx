import React, { useCallback, useEffect, useState } from 'react';
import { View, Pressable, ScrollView, Image } from 'react-native';
import { Camera } from 'lucide-react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  pickImage,
  uploadProfilePicture,
} from '@/lib/services/imageUploadService';
import {
  setAvatarUrl,
  updateProfileBasics,
} from '@/lib/services/profileService';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const DISPLAY_NAME_MAX = 50;
const BIO_MAX = 280;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

export function EditProfileSheet({ visible, onClose }: Props) {
  const { user } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { theme } = useTheme();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setDisplayName(profile?.displayName ?? '');
      setBio(profile?.bio ?? '');
      setPendingAvatarUri(null);
      setSubmitting(false);
    }
  }, [visible, profile?.displayName, profile?.bio]);

  const onAvatarTap = useCallback(async () => {
    haptic('light');
    try {
      const uri = await pickImage({ aspect: [1, 1], quality: 0.9 });
      if (uri) setPendingAvatarUri(uri);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not pick image');
    }
  }, []);

  const submit = useCallback(
    async (closeFn: () => void) => {
      if (!user) return;
      const trimmedDisplay = displayName.trim();
      if (!trimmedDisplay) {
        toast.error('Display name is required');
        return;
      }
      if (trimmedDisplay.length > DISPLAY_NAME_MAX) {
        toast.error(`Display name must be ${DISPLAY_NAME_MAX} characters or less`);
        return;
      }
      if (bio.trim().length > BIO_MAX) {
        toast.error(`Bio must be ${BIO_MAX} characters or less`);
        return;
      }
      setSubmitting(true);
      try {
        // Username is read-only in v1 — renaming requires a transactional
        // slug migration that's out of scope. The full creator/brand
        // settings page (step 3) handles dmContact/niches/industry.
        await updateProfileBasics(user.id, {
          displayName: trimmedDisplay,
          bio: bio.trim(),
        });
        if (pendingAvatarUri) {
          const url = await uploadProfilePicture(pendingAvatarUri);
          await setAvatarUrl(user.id, url);
        }
        await refreshProfile();
        toast.success('Profile updated');
        closeFn();
      } catch (err: any) {
        toast.error(err?.message ?? 'Update failed');
        setSubmitting(false);
      }
    },
    [user, displayName, bio, pendingAvatarUri, refreshProfile],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Edit profile"
      height={620}
      keyboardAware
      dismissible={!submitting}
    >
      {({ close }) => (
        <ScrollView
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar with overlay camera affordance */}
          <Pressable
            onPress={onAvatarTap}
            style={{ alignSelf: 'center', position: 'relative' }}
          >
            {pendingAvatarUri ? (
              <Image
                source={{ uri: pendingAvatarUri }}
                style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme[200] }}
              />
            ) : (
              <View style={{ width: 88, height: 88, borderRadius: 44, overflow: 'hidden' }}>
                <Avatar
                  avatarUrl={profile?.avatarUrl}
                  size="lg"
                  initial={profile?.displayName?.[0]}
                />
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: theme[950],
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: theme[50],
              }}
            >
              <Camera size={14} color={theme[50]} strokeWidth={2} />
            </View>
          </Pressable>

          <Field label="Display name">
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              maxLength={DISPLAY_NAME_MAX}
            />
          </Field>
          <Field label="Username">
            <TextInput
              value={profile?.username ?? ''}
              editable={false}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ThemedText type="caption" style={{ color: theme[500] }}>
              Username is locked in v1 — renaming is coming later.
            </ThemedText>
          </Field>
          <Field label="Bio">
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="A short line about you"
              multiline
              maxLength={BIO_MAX}
              style={{ minHeight: 96, textAlignVertical: 'top' }}
            />
          </Field>

          <Button
            title={submitting ? 'Saving…' : 'Save'}
            onPress={() => submit(close)}
            loading={submitting}
            disabled={submitting}
            variant="primary"
            size="lg"
            className="w-full"
          />
        </ScrollView>
      )}
    </BottomSheet>
  );
}

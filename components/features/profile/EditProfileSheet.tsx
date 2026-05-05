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
import { isUsernameAvailable, updateProfile } from '@/lib/services/profileService';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const DISPLAY_NAME_MAX = 50;
const USERNAME_MAX = 20;
const BIO_MAX = 280;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

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
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setDisplayName(profile?.displayName ?? '');
      setUsername(profile?.username ?? '');
      setBio(profile?.bio ?? '');
      setPendingAvatarUri(null);
      setSubmitting(false);
    }
  }, [visible, profile?.displayName, profile?.username, profile?.bio]);

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
      const trimmedUsername = username.trim().toLowerCase().replace(/\s+/g, '');
      if (!trimmedDisplay || !trimmedUsername) {
        toast.error('Display name and username are required');
        return;
      }
      if (trimmedDisplay.length > DISPLAY_NAME_MAX) {
        toast.error(`Display name must be ${DISPLAY_NAME_MAX} characters or less`);
        return;
      }
      if (!USERNAME_REGEX.test(trimmedUsername)) {
        toast.error('Username must be 3–20 characters, lowercase letters, digits, or underscore');
        return;
      }
      if (bio.trim().length > BIO_MAX) {
        toast.error(`Bio must be ${BIO_MAX} characters or less`);
        return;
      }
      setSubmitting(true);
      try {
        // Best-effort availability check up front — saves a transaction roundtrip
        // when the username is obviously taken. The transactional write below
        // is still the source of truth for race-free claims.
        if (trimmedUsername !== profile?.username) {
          const available = await isUsernameAvailable(trimmedUsername, user.id);
          if (!available) {
            toast.error('That username is taken');
            setSubmitting(false);
            return;
          }
        }

        let avatarUrl = profile?.avatarUrl ?? null;
        if (pendingAvatarUri) {
          avatarUrl = await uploadProfilePicture(pendingAvatarUri);
        }
        await updateProfile(user.id, {
          displayName: trimmedDisplay,
          username: trimmedUsername,
          bio: bio.trim(),
          avatarUrl,
        });
        await refreshProfile();
        toast.success('Profile updated');
        closeFn();
      } catch (err: any) {
        toast.error(err?.message ?? 'Update failed');
        setSubmitting(false);
      }
    },
    [user, displayName, username, bio, pendingAvatarUri, profile?.username, profile?.avatarUrl, refreshProfile],
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
              value={username}
              onChangeText={setUsername}
              placeholder="lowercase, no spaces"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={USERNAME_MAX}
            />
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

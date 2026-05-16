import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, View, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import {
    changeUsername,
    isUsernameAvailable,
    setAvatarUrl,
    setLocation,
    updateProfileBasics,
    USERNAME_PATTERN,
} from '@/lib/services/profileService';
import { USERNAME_COOLDOWN_MS } from '@/lib/types/profile';
import { pickImage, uploadProfilePicture } from '@/lib/services/imageUploadService';
import { toast, toastError } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { useDebounce } from '@/hooks/useDebounce';
import { COUNTRIES, codeToFlag, countryName } from '@/lib/constants/countries';
import type { ProfileLocation } from '@/lib/types/profile';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function SettingsProfileScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { theme } = useTheme();
    const { profile, refreshProfile } = useUser();
    const [username, setUsername] = useState(profile?.username ?? '');
    const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
    const [bio, setBio] = useState(profile?.bio ?? '');
    const initialCountry =
        profile?.location.kind === 'country' ? profile.location.country : null;
    const [countryCode, setCountryCode] = useState<string | null>(initialCountry);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [avatarBusy, setAvatarBusy] = useState(false);

    const lastChange = profile?.lastUsernameChangeAt ?? 0;
    const cooldownRemainingMs =
        lastChange > 0 ? Math.max(0, USERNAME_COOLDOWN_MS - (Date.now() - lastChange)) : 0;
    const cooldownDaysLeft = Math.ceil(cooldownRemainingMs / 86400000);
    const cooldownActive = cooldownRemainingMs > 0;
    const trimmedUsername = username.trim().toLowerCase();
    const profileUsername = profile?.username ?? '';
    const usernameChanged = !!profile && trimmedUsername !== profileUsername;
    const userId = user?.id ?? null;

    // M12: debounced live availability check. Mirrors the rule check so
    // taken-username errors surface before Save.
    const debouncedUsername = useDebounce(trimmedUsername, 300);
    const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
    useEffect(() => {
        if (!userId || !usernameChanged || !debouncedUsername) {
            setUsernameStatus('idle');
            return;
        }
        if (!USERNAME_PATTERN.test(debouncedUsername)) {
            setUsernameStatus('invalid');
            return;
        }
        let cancelled = false;
        setUsernameStatus('checking');
        isUsernameAvailable(debouncedUsername, userId)
            .then((available) => {
                if (cancelled) return;
                setUsernameStatus(available ? 'available' : 'taken');
            })
            .catch(() => {
                if (cancelled) return;
                setUsernameStatus('idle');
            });
        return () => {
            cancelled = true;
        };
    }, [debouncedUsername, usernameChanged, userId]);

    if (!profile || !user) return <ThemedView style={{ flex: 1 }} />;

    const onPickAvatar = async () => {
        try {
            const uri = await pickImage({ aspect: [1, 1], quality: 0.85 });
            if (!uri) return;
            setAvatarBusy(true);
            const url = await uploadProfilePicture(uri);
            await setAvatarUrl(user.id, url);
            await refreshProfile();
            toast.success('Avatar updated');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Avatar upload failed');
        } finally {
            setAvatarBusy(false);
        }
    };

    const onSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            // Username change is a separate atomic TX (uniqueness + cooldown).
            // Run it first; if it fails, abort before touching other fields so
            // the user sees a clean error.
            if (usernameChanged) {
                await changeUsername(user.id, trimmedUsername);
            }
            const trimmedName = displayName.trim().slice(0, 50);
            const trimmedBio = bio.trim().slice(0, 280);
            await updateProfileBasics(user.id, { displayName: trimmedName, bio: trimmedBio });
            const newLocation: ProfileLocation = countryCode
                ? { kind: 'country', country: countryCode }
                : { kind: 'global', country: null };
            await setLocation(user.id, newLocation);
            await refreshProfile();
            // L1: project vocabulary — `heavy` for confirmed/major events.
            haptic('heavy');
            toast.success('Profile updated');
            router.back();
        } catch (err) {
            toastError(err, 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const saveBlocked =
        saving
        || (usernameChanged && (usernameStatus === 'checking' || usernameStatus === 'taken' || usernameStatus === 'invalid'));

    return (
        <ThemedView style={{ flex: 1 }}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
                <ScreenHeader title="Profile" />
                <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 16, paddingBottom: 240 }}>
                    <View style={{ alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <Pressable onPress={onPickAvatar} accessibilityRole="button">
                            {profile.avatarUrl ? (
                                <Image
                                    source={{ uri: profile.avatarUrl }}
                                    style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: theme[100] }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 96,
                                        height: 96,
                                        borderRadius: 48,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: theme[100],
                                    }}
                                >
                                    <Icon name="camera.fill" size={32} color={theme[500]} />
                                </View>
                            )}
                        </Pressable>
                        <ThemedText type="caption" style={{ color: theme[500] }}>
                            {avatarBusy ? 'Uploading…' : 'Tap to change'}
                        </ThemedText>
                    </View>

                    <View style={{ gap: 8, marginBottom: 24 }}>
                        <SectionLabel label="USERNAME" />
                        <TextInput
                            value={username}
                            onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            placeholder={profile.username}
                            maxLength={20}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!cooldownActive}
                            leftIcon={<ThemedText type="body-md" style={{ color: theme[400] }}>@</ThemedText>}
                        />
                        <ThemedText
                            type="caption"
                            style={{
                                color:
                                    usernameStatus === 'taken' || usernameStatus === 'invalid'
                                        ? '#DC143C'
                                        : usernameStatus === 'available'
                                        ? theme[700]
                                        : theme[500],
                            }}
                        >
                            {cooldownActive
                                ? `You can change your username again in ${cooldownDaysLeft} day${cooldownDaysLeft === 1 ? '' : 's'}.`
                                : usernameStatus === 'checking'
                                ? 'Checking availability…'
                                : usernameStatus === 'available'
                                ? 'Available'
                                : usernameStatus === 'taken'
                                ? 'Username already taken'
                                : usernameStatus === 'invalid'
                                ? 'Must be 3–20 lowercase letters, digits, or underscores.'
                                : '3–20 lowercase letters, digits, or underscores. One change per 30 days.'}
                        </ThemedText>
                    </View>

                    <View style={{ gap: 8, marginBottom: 24 }}>
                        <SectionLabel label="DISPLAY NAME" />
                        <TextInput
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder={profile.displayName}
                            maxLength={50}
                        />
                    </View>

                    <View style={{ gap: 8, marginBottom: 24 }}>
                        <SectionLabel label="BIO" />
                        <TextInput
                            value={bio}
                            onChangeText={setBio}
                            placeholder="Tell people what you ship."
                            multiline
                            numberOfLines={4}
                            maxLength={280}
                            style={{ height: 96, textAlignVertical: 'top' }}
                        />
                    </View>

                    <View style={{ gap: 8, marginBottom: 24 }}>
                        <SectionLabel label="COUNTRY" />
                        <Pressable
                            onPress={() => {
                                haptic('light');
                                setPickerOpen(true);
                            }}
                            accessibilityRole="button"
                            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    backgroundColor: theme[100],
                                }}
                            >
                                <ThemedText
                                    type="body-md"
                                    style={{ fontSize: 18, lineHeight: 20, marginRight: 12 }}
                                >
                                    {countryCode ? codeToFlag(countryCode) : '🌐'}
                                </ThemedText>
                                <ThemedText
                                    type="body-md"
                                    style={{ color: theme[950], flex: 1 }}
                                    numberOfLines={1}
                                >
                                    {countryCode ? countryName(countryCode) ?? countryCode : 'Global'}
                                </ThemedText>
                                <Icon name="chevron.down" size={14} color={theme[500]} />
                            </View>
                        </Pressable>
                    </View>
                </ScrollView>

                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: theme[50] }}>
                    <Button
                        size="lg"
                        variant="primary"
                        title={saving ? 'Saving…' : 'Save'}
                        loading={saving}
                        disabled={saveBlocked}
                        onPress={onSave}
                    />
                </View>
            </SafeAreaView>

            <CountryPickerSheet
                visible={pickerOpen}
                selected={countryCode}
                onClose={() => setPickerOpen(false)}
                onSelect={(code) => {
                    setCountryCode(code);
                    setPickerOpen(false);
                }}
            />
        </ThemedView>
    );
}

interface CountryPickerSheetProps {
    visible: boolean;
    selected: string | null;
    onClose: () => void;
    onSelect: (code: string | null) => void;
}

function CountryPickerSheet({ visible, selected, onClose, onSelect }: CountryPickerSheetProps) {
    const { theme } = useTheme();
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return COUNTRIES;
        return COUNTRIES.filter(
            (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
        );
    }, [search]);

    return (
        <BottomSheet
            visible={visible}
            onClose={() => {
                setSearch('');
                onClose();
            }}
            title="Pick a country"
            height={640}
            keyboardAware
        >
            {() => (
                <View style={{ flex: 1, paddingTop: 8 }}>
                    <View style={{ paddingBottom: 8 }}>
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Search…"
                            autoCapitalize="none"
                            autoCorrect={false}
                            leftIcon={<Icon name="magnifyingglass" size={16} color={theme[400]} />}
                        />
                    </View>
                    <FlatList
                        data={filtered}
                        keyExtractor={(c) => c.code}
                        keyboardShouldPersistTaps="handled"
                        ListHeaderComponent={
                            <Pressable
                                onPress={() => {
                                    haptic('light');
                                    onSelect(null);
                                }}
                                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                            >
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: theme[100],
                                    }}
                                >
                                    <ThemedText type="body-md" style={{ fontSize: 20, lineHeight: 20, marginRight: 12 }}>
                                        🌐
                                    </ThemedText>
                                    <ThemedText type="body-md" style={{ color: theme[950], flex: 1 }}>
                                        Global
                                    </ThemedText>
                                    {selected === null ? (
                                        <Icon name="checkmark" size={16} color={theme[700]} />
                                    ) : null}
                                </View>
                            </Pressable>
                        }
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => {
                                    haptic('light');
                                    onSelect(item.code);
                                }}
                                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                            >
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: theme[100],
                                    }}
                                >
                                    <ThemedText type="body-md" style={{ fontSize: 20, lineHeight: 20, marginRight: 12 }}>
                                        {codeToFlag(item.code)}
                                    </ThemedText>
                                    <ThemedText
                                        type="body-md"
                                        style={{ color: theme[950], flex: 1 }}
                                        numberOfLines={1}
                                    >
                                        {item.name}
                                    </ThemedText>
                                    {selected === item.code ? (
                                        <Icon name="checkmark" size={16} color={theme[700]} />
                                    ) : null}
                                </View>
                            </Pressable>
                        )}
                    />
                </View>
            )}
        </BottomSheet>
    );
}

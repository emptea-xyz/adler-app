import React, { useState } from 'react';
import { ScrollView, View, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, MapPin } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import {
    setAvatarUrl,
    setLocation,
    updateProfileBasics,
} from '@/lib/services/profileService';
import { pickImage, uploadProfilePicture } from '@/lib/services/imageUploadService';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import type { ProfileLocation } from '@/lib/types/profile';

export default function SettingsProfileScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { theme } = useTheme();
    const { profile, refreshProfile } = useUser();
    const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
    const [bio, setBio] = useState(profile?.bio ?? '');
    const [city, setCity] = useState(profile?.location.city ?? '');
    const [country, setCountry] = useState(profile?.location.country ?? '');
    const [saving, setSaving] = useState(false);
    const [avatarBusy, setAvatarBusy] = useState(false);

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
            const trimmedName = displayName.trim().slice(0, 50);
            const trimmedBio = bio.trim().slice(0, 280);
            await updateProfileBasics(user.id, { displayName: trimmedName, bio: trimmedBio });
            const trimmedCity = city.trim();
            const trimmedCountry = country.trim().toUpperCase();
            const newLocation: ProfileLocation =
                trimmedCity && trimmedCountry.length === 2
                    ? { kind: 'city', city: trimmedCity, country: trimmedCountry }
                    : { kind: 'global', city: null, country: null };
            await setLocation(user.id, newLocation);
            await refreshProfile();
            haptic('success');
            toast.success('Profile updated');
            router.back();
        } catch (err) {
            haptic('error');
            toast.error(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
                <ScreenHeader title="Profile" />
                <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 240 }}>
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
                                    <Camera size={32} color={theme[500]} />
                                </View>
                            )}
                        </Pressable>
                        <ThemedText type="caption" style={{ color: theme[500] }}>
                            {avatarBusy ? 'Uploading…' : 'Tap to change'}
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
                        <SectionLabel label="LOCATION" />
                        <Card variant="filled">
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <MapPin size={16} color={theme[700]} />
                                <ThemedText type="body-sm" style={{ color: theme[700] }}>
                                    Leave blank to set Global
                                </ThemedText>
                            </View>
                            <TextInput
                                value={city}
                                onChangeText={setCity}
                                placeholder="City"
                                maxLength={60}
                                style={{ marginBottom: 8 }}
                            />
                            <TextInput
                                value={country}
                                onChangeText={(v) => setCountry(v.toUpperCase())}
                                placeholder="Country (ISO-2, e.g. CH)"
                                maxLength={2}
                                autoCapitalize="characters"
                            />
                        </Card>
                    </View>

                    <ThemedText type="caption" style={{ color: theme[500] }}>
                        Username @{profile.username} can&apos;t be changed.
                    </ThemedText>
                </ScrollView>

                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: theme[50] }}>
                    <Button
                        size="lg"
                        variant="primary"
                        title={saving ? 'Saving…' : 'Save'}
                        loading={saving}
                        disabled={saving}
                        onPress={onSave}
                    />
                </View>
            </SafeAreaView>
        </ThemedView>
    );
}

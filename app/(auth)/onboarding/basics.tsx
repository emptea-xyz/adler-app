import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { SearchableSheet, type SearchableSheetOption } from '@/components/ui/SearchableSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/lib/utils/toast';

const COUNTRIES: readonly SearchableSheetOption[] = [
    { label: 'Global', value: 'GLOBAL' },
    { label: 'United States', value: 'US' },
    { label: 'Canada', value: 'CA' },
    { label: 'United Kingdom', value: 'GB' },
    { label: 'Germany', value: 'DE' },
    { label: 'France', value: 'FR' },
    { label: 'Netherlands', value: 'NL' },
    { label: 'Spain', value: 'ES' },
    { label: 'Italy', value: 'IT' },
    { label: 'Australia', value: 'AU' },
    { label: 'India', value: 'IN' },
    { label: 'Singapore', value: 'SG' },
    { label: 'Japan', value: 'JP' },
    { label: 'Brazil', value: 'BR' },
    { label: 'Mexico', value: 'MX' },
];

function ProgressDots() {
    const { theme } = useTheme();
    return (
        <View style={{ flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2].map((dot) => (
                <View
                    key={dot}
                    style={{
                        width: 22,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: dot === 0 ? theme[950] : theme[200],
                    }}
                />
            ))}
        </View>
    );
}

export default function BasicsScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { profile } = useUser();
    const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
    const [bio, setBio] = useState(profile?.bio ?? '');
    const [country, setCountry] = useState(profile?.country ?? null);
    const [countryOpen, setCountryOpen] = useState(false);

    const countryLabel = useMemo(() => {
        if (!country) return 'Global';
        return COUNTRIES.find((option) => option.value === country)?.label ?? country;
    }, [country]);

    const onNext = () => {
        const name = displayName.trim();
        const nextBio = bio.trim();
        if (name.length < 1 || name.length > 50) {
            toast.error('Display name must be 1-50 characters.');
            return;
        }
        if (nextBio.length > 280) {
            toast.error('Bio must be 280 characters or less.');
            return;
        }
        router.push({
            pathname: '/(auth)/onboarding/creator',
            params: {
                displayName: name,
                bio: nextBio,
                country: country ?? '',
            },
        });
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top', 'bottom']} className="flex-1">
                <View className="px-6 pt-4 pb-3">
                    <ProgressDots />
                </View>
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120, gap: 18 }}
                >
                    <View style={{ gap: 8, paddingTop: 18 }}>
                        <ThemedText type="h3" style={{ color: theme[950] }}>
                            Basics
                        </ThemedText>
                        <ThemedText type="body-md" style={{ color: theme[500] }}>
                            Set the shared identity brands and creators will see.
                        </ThemedText>
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="caption-semibold">DISPLAY NAME</ThemedText>
                        <TextInput value={displayName} onChangeText={setDisplayName} maxLength={50} />
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="caption-semibold">BIO</ThemedText>
                        <TextInput
                            value={bio}
                            onChangeText={setBio}
                            maxLength={280}
                            multiline
                            style={{ minHeight: 112, textAlignVertical: 'top' }}
                        />
                        <ThemedText type="caption" align="right">
                            {bio.length}/280
                        </ThemedText>
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="caption-semibold">COUNTRY</ThemedText>
                        <Pressable
                            onPress={() => setCountryOpen(true)}
                            accessibilityRole="button"
                            style={{
                                minHeight: 50,
                                borderRadius: 12,
                                paddingHorizontal: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: theme[100],
                            }}
                        >
                            <ThemedText type="body-md-semibold">{countryLabel}</ThemedText>
                            <ChevronDown size={18} color={theme[500]} />
                        </Pressable>
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="caption-semibold">HANDLE</ThemedText>
                        <View
                            style={{
                                minHeight: 50,
                                borderRadius: 999,
                                paddingHorizontal: 16,
                                alignItems: 'center',
                                flexDirection: 'row',
                                backgroundColor: theme[100],
                            }}
                        >
                            <ThemedText type="body-md-semibold">@{profile?.username ?? 'reserved'}</ThemedText>
                        </View>
                        <ThemedText type="caption">
                            You can rename this later.
                        </ThemedText>
                    </View>
                </ScrollView>
                <View style={{ position: 'absolute', left: 24, right: 24, bottom: 24 }}>
                    <Button title="Next" onPress={onNext} size="lg" />
                </View>
                <SearchableSheet
                    visible={countryOpen}
                    title="Country"
                    options={COUNTRIES}
                    value={country ?? 'GLOBAL'}
                    onSelect={(value) => setCountry(value === 'GLOBAL' ? null : value)}
                    onClose={() => setCountryOpen(false)}
                />
            </SafeAreaView>
        </ThemedView>
    );
}

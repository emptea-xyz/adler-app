import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { SearchableSheet, type SearchableSheetOption } from '@/components/ui/SearchableSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { completeDualProfileOnboarding } from '@/lib/services/profileService';
import { INDUSTRY_GROUPS } from '@/lib/utils/industries';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';
import type { SocialLink } from '@/lib/types/profile';
import { toast } from '@/lib/utils/toast';

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
                        backgroundColor: theme[950],
                    }}
                />
            ))}
        </View>
    );
}

function parseJsonParam<T>(value: string | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

export default function BrandScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams<{
        displayName?: string;
        bio?: string;
        country?: string;
        niches?: string;
        portfolioUrl?: string;
        socialLinks?: string;
    }>();
    const { user } = useAuth();
    const { refreshProfile } = useUser();
    const [companyName, setCompanyName] = useState('');
    const [industry, setIndustry] = useState<string | null>(null);
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [industryOpen, setIndustryOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const industryOptions = useMemo<readonly SearchableSheetOption[]>(
        () => INDUSTRY_GROUPS.flatMap((group) => (
            group.options.map((option) => ({
                label: option,
                value: option,
                group: group.label,
            }))
        )),
        [],
    );

    const finish = async () => {
        if (!user) return;
        const company = companyName.trim();
        const website = websiteUrl.trim();
        if (company.length < 1 || company.length > 60) {
            toast.error('Company name must be 1-60 characters.');
            return;
        }
        if (website && !/^https?:\/\/.+\..+/i.test(website)) {
            toast.error('Website must be a full URL.');
            return;
        }

        setSubmitting(true);
        try {
            await completeDualProfileOnboarding(user.id, {
                displayName: params.displayName ?? '',
                bio: params.bio ?? '',
                country: params.country ? params.country : null,
                creatorProfile: {
                    niches: parseJsonParam<string[]>(params.niches, []),
                    portfolioUrl: params.portfolioUrl ? params.portfolioUrl : null,
                    socialLinks: parseJsonParam<SocialLink[]>(params.socialLinks, []),
                    dmContact: null,
                },
                brandProfile: {
                    companyName: company,
                    industry,
                    websiteUrl: website || null,
                    dmContact: null,
                },
            });
            await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, 'true').catch(() => {});
            await refreshProfile();
            router.replace('/(home)/(tabs)/browse');
        } catch (err: any) {
            toast.error(err?.message ?? 'Onboarding failed.');
            setSubmitting(false);
        }
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top', 'bottom']} className="flex-1">
                <View className="px-6 pt-4 pb-3" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
                        <ArrowLeft size={22} color={theme[950]} />
                    </Pressable>
                    <ProgressDots />
                    <View style={{ width: 22 }} />
                </View>
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120, gap: 18 }}
                >
                    <View style={{ gap: 8, paddingTop: 18 }}>
                        <ThemedText type="h3">Brand</ThemedText>
                        <ThemedText type="body-md" style={{ color: theme[500] }}>
                            Add the buying side of your marketplace account.
                        </ThemedText>
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="caption-semibold">COMPANY NAME</ThemedText>
                        <TextInput value={companyName} onChangeText={setCompanyName} maxLength={60} />
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="caption-semibold">INDUSTRY</ThemedText>
                        <Pressable
                            onPress={() => setIndustryOpen(true)}
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
                            <ThemedText type="body-md-semibold" style={{ color: industry ? theme[950] : theme[500] }}>
                                {industry ?? 'Pick industry'}
                            </ThemedText>
                            <ChevronDown size={18} color={theme[500]} />
                        </Pressable>
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="caption-semibold">WEBSITE URL</ThemedText>
                        <TextInput value={websiteUrl} onChangeText={setWebsiteUrl} placeholder="https://..." autoCapitalize="none" />
                    </View>
                </ScrollView>
                <View style={{ position: 'absolute', left: 24, right: 24, bottom: 24 }}>
                    <Button title="Finish" onPress={finish} size="lg" loading={submitting} />
                </View>
                <SearchableSheet
                    visible={industryOpen}
                    title="Industry"
                    options={industryOptions}
                    value={industry}
                    onSelect={setIndustry}
                    onClose={() => setIndustryOpen(false)}
                />
            </SafeAreaView>
        </ThemedView>
    );
}

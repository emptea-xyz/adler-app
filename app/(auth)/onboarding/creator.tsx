import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus, X } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { SearchableSheet, type SearchableSheetOption } from '@/components/ui/SearchableSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { SUGGESTED_NICHES, NICHE_PATTERN, normalizeNiche } from '@/lib/utils/niches';
import { detectAndNormalizeSocialLink, PLATFORM_LABEL } from '@/lib/utils/socialLinks';
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
                        backgroundColor: dot <= 1 ? theme[950] : theme[200],
                    }}
                />
            ))}
        </View>
    );
}

export default function CreatorScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams<{ displayName?: string; bio?: string; country?: string }>();
    const [niches, setNiches] = useState<string[]>([]);
    const [portfolioUrl, setPortfolioUrl] = useState('');
    const [socialInput, setSocialInput] = useState('');
    const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
    const [nicheOpen, setNicheOpen] = useState(false);

    const nicheOptions = useMemo<readonly SearchableSheetOption[]>(
        () => SUGGESTED_NICHES.map((niche) => ({ label: niche, value: niche })),
        [],
    );

    const toggleNiche = (raw: string) => {
        const niche = normalizeNiche(raw);
        if (!NICHE_PATTERN.test(niche)) {
            toast.error('Use a short lowercase niche.');
            return;
        }
        setNiches((current) => {
            if (current.includes(niche)) return current.filter((item) => item !== niche);
            if (current.length >= 6) {
                toast.error('Pick up to 6 niches.');
                return current;
            }
            return [...current, niche];
        });
    };

    const addSocial = () => {
        const result = detectAndNormalizeSocialLink(socialInput);
        if (!result.ok) {
            toast.error(result.error);
            return;
        }
        const next: SocialLink = { platform: result.platform, handle: result.handle };
        setSocialLinks((current) => {
            if (current.some((link) => link.platform === next.platform && link.handle.toLowerCase() === next.handle.toLowerCase())) {
                toast.error('That social link is already added.');
                return current;
            }
            return [...current, next];
        });
        setSocialInput('');
    };

    const onNext = () => {
        if (niches.length < 1) {
            toast.error('Pick at least one niche.');
            return;
        }
        const portfolio = portfolioUrl.trim();
        if (portfolio && !/^https?:\/\/.+\..+/i.test(portfolio)) {
            toast.error('Portfolio must be a full URL.');
            return;
        }
        router.push({
            pathname: '/(auth)/onboarding/brand',
            params: {
                displayName: params.displayName ?? '',
                bio: params.bio ?? '',
                country: params.country ?? '',
                niches: JSON.stringify(niches),
                portfolioUrl: portfolio,
                socialLinks: JSON.stringify(socialLinks),
            },
        });
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
                        <ThemedText type="h3">Creator</ThemedText>
                        <ThemedText type="body-md" style={{ color: theme[500] }}>
                            Tell brands what kind of content you make.
                        </ThemedText>
                    </View>
                    <View style={{ gap: 10 }}>
                        <ThemedText type="caption-semibold">NICHES</ThemedText>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {SUGGESTED_NICHES.map((niche) => {
                                const selected = niches.includes(niche);
                                return (
                                    <Pressable
                                        key={niche}
                                        onPress={() => toggleNiche(niche)}
                                        style={{
                                            minHeight: 36,
                                            borderRadius: 999,
                                            paddingHorizontal: 14,
                                            justifyContent: 'center',
                                            backgroundColor: selected ? theme[950] : theme[100],
                                        }}
                                    >
                                        <ThemedText type="body-sm-semibold" style={{ color: selected ? theme[50] : theme[950] }}>
                                            {niche}
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                            <Pressable
                                onPress={() => setNicheOpen(true)}
                                style={{
                                    minHeight: 36,
                                    borderRadius: 999,
                                    paddingHorizontal: 12,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    backgroundColor: theme[100],
                                }}
                            >
                                <Plus size={14} color={theme[950]} />
                                <ThemedText type="body-sm-semibold">More</ThemedText>
                            </Pressable>
                        </View>
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="caption-semibold">PORTFOLIO URL</ThemedText>
                        <TextInput value={portfolioUrl} onChangeText={setPortfolioUrl} placeholder="https://..." autoCapitalize="none" />
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="caption-semibold">SOCIAL LINKS</ThemedText>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TextInput
                                value={socialInput}
                                onChangeText={setSocialInput}
                                placeholder="Paste profile URL"
                                autoCapitalize="none"
                                containerClassName="flex-1"
                            />
                            <Button title="Add" onPress={addSocial} variant="secondary" disabled={!socialInput.trim()} />
                        </View>
                        {socialLinks.map((link) => (
                            <View
                                key={`${link.platform}:${link.handle}`}
                                style={{
                                    minHeight: 42,
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    backgroundColor: theme[100],
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <ThemedText type="body-sm-semibold">
                                    {PLATFORM_LABEL[link.platform]} @{link.handle}
                                </ThemedText>
                                <Pressable
                                    onPress={() => setSocialLinks((current) => current.filter((item) => item !== link))}
                                    hitSlop={8}
                                >
                                    <X size={16} color={theme[500]} />
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </ScrollView>
                <View style={{ position: 'absolute', left: 24, right: 24, bottom: 24 }}>
                    <Button title="Next" onPress={onNext} size="lg" />
                </View>
                <SearchableSheet
                    visible={nicheOpen}
                    title="Niches"
                    options={nicheOptions}
                    value={null}
                    onSelect={toggleNiche}
                    onClose={() => setNicheOpen(false)}
                />
            </SafeAreaView>
        </ThemedView>
    );
}

import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, ChevronDown, Plus, X } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { SearchableSheet, type SearchableSheetOption } from '@/components/ui/SearchableSheet';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import {
    setAvatarUrl,
    setCountry,
    updateBrandProfile,
    updateCreatorProfile,
    updateProfileBasics,
} from '@/lib/services/profileService';
import { pickImage, uploadProfilePicture } from '@/lib/services/imageUploadService';
import { INDUSTRY_GROUPS } from '@/lib/utils/industries';
import { SUGGESTED_NICHES, NICHE_PATTERN, normalizeNiche } from '@/lib/utils/niches';
import {
    detectAndNormalizeSocialLink,
    PLATFORM_LABEL,
} from '@/lib/utils/socialLinks';
import { toast } from '@/lib/utils/toast';
import type { DmContact, SocialLink } from '@/lib/types/profile';

const DISPLAY_NAME_MAX = 50;
const BIO_MAX = 280;

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View style={{ gap: 8 }}>
            <SectionLabel label={label} />
            {children}
        </View>
    );
}

function dmState(value: DmContact | null | undefined): DmContact {
    return {
        email: value?.email ?? '',
        telegram: value?.telegram ?? '',
        phone: value?.phone ?? '',
    };
}

export default function SettingsProfileScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { profile, refreshProfile } = useUser();
    const { theme } = useTheme();

    const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
    const [bio, setBio] = useState(profile?.bio ?? '');
    const [country, setCountryState] = useState(profile?.country ?? null);
    const [niches, setNiches] = useState<string[]>(profile?.creatorProfile?.niches ?? []);
    const [portfolioUrl, setPortfolioUrl] = useState(profile?.creatorProfile?.portfolioUrl ?? '');
    const [socialInput, setSocialInput] = useState('');
    const [socialLinks, setSocialLinks] = useState<SocialLink[]>(profile?.creatorProfile?.socialLinks ?? []);
    const [creatorDm, setCreatorDm] = useState<DmContact>(dmState(profile?.creatorProfile?.dmContact));
    const [companyName, setCompanyName] = useState(profile?.brandProfile?.companyName ?? '');
    const [industry, setIndustry] = useState<string | null>(profile?.brandProfile?.industry ?? null);
    const [websiteUrl, setWebsiteUrl] = useState(profile?.brandProfile?.websiteUrl ?? '');
    const [brandDm, setBrandDm] = useState<DmContact>(dmState(profile?.brandProfile?.dmContact));
    const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
    const [countryOpen, setCountryOpen] = useState(false);
    const [industryOpen, setIndustryOpen] = useState(false);
    const [nicheOpen, setNicheOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const countryLabel = useMemo(() => {
        if (!country) return 'Global';
        return COUNTRIES.find((option) => option.value === country)?.label ?? country;
    }, [country]);

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

    const pickAvatar = async () => {
        try {
            const uri = await pickImage({ aspect: [1, 1], quality: 0.9 });
            if (uri) setPendingAvatarUri(uri);
        } catch (err: any) {
            toast.error(err?.message ?? 'Could not pick image');
        }
    };

    const save = async () => {
        if (!user) return;
        const trimmedName = displayName.trim();
        const trimmedBio = bio.trim();
        const portfolio = portfolioUrl.trim();
        const website = websiteUrl.trim();
        const company = companyName.trim();

        if (!trimmedName || trimmedName.length > DISPLAY_NAME_MAX) {
            toast.error('Display name must be 1-50 characters.');
            return;
        }
        if (trimmedBio.length > BIO_MAX) {
            toast.error('Bio must be 280 characters or less.');
            return;
        }
        if (niches.length < 1) {
            toast.error('Pick at least one creator niche.');
            return;
        }
        if (portfolio && !/^https?:\/\/.+\..+/i.test(portfolio)) {
            toast.error('Portfolio must be a full URL.');
            return;
        }
        if (!company || company.length > 60) {
            toast.error('Company name must be 1-60 characters.');
            return;
        }
        if (website && !/^https?:\/\/.+\..+/i.test(website)) {
            toast.error('Website must be a full URL.');
            return;
        }

        setSaving(true);
        try {
            await updateProfileBasics(user.id, { displayName: trimmedName, bio: trimmedBio });
            await setCountry(user.id, country);
            await updateCreatorProfile(user.id, {
                niches,
                portfolioUrl: portfolio || null,
                socialLinks,
                dmContact: creatorDm,
            });
            await updateBrandProfile(user.id, {
                companyName: company,
                industry,
                websiteUrl: website || null,
                dmContact: brandDm,
            });
            if (pendingAvatarUri) {
                const url = await uploadProfilePicture(pendingAvatarUri);
                await setAvatarUrl(user.id, url);
            }
            await refreshProfile();
            toast.success('Profile saved');
            router.back();
        } catch (err: any) {
            toast.error(err?.message ?? 'Save failed');
            setSaving(false);
        }
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="Profile" onBack={() => router.back()} />
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 16,
                        paddingBottom: 136,
                        gap: 24,
                    }}
                >
                    <Pressable onPress={pickAvatar} style={{ alignSelf: 'center', position: 'relative' }}>
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
                                width: 30,
                                height: 30,
                                borderRadius: 15,
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

                    <View style={{ gap: 14 }}>
                        <Field label="Basics">
                            <TextInput value={displayName} onChangeText={setDisplayName} maxLength={DISPLAY_NAME_MAX} />
                            <TextInput value={profile?.username ?? ''} editable={false} autoCapitalize="none" />
                            <TextInput
                                value={bio}
                                onChangeText={setBio}
                                multiline
                                maxLength={BIO_MAX}
                                style={{ minHeight: 96, textAlignVertical: 'top' }}
                            />
                            <Pressable
                                onPress={() => setCountryOpen(true)}
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
                        </Field>
                    </View>

                    <View style={{ gap: 14 }}>
                        <Field label="Creator">
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
                            <TextInput value={portfolioUrl} onChangeText={setPortfolioUrl} placeholder="Portfolio URL" autoCapitalize="none" />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TextInput
                                    value={socialInput}
                                    onChangeText={setSocialInput}
                                    placeholder="Social profile URL"
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
                                    <Pressable onPress={() => setSocialLinks((current) => current.filter((item) => item !== link))} hitSlop={8}>
                                        <X size={16} color={theme[500]} />
                                    </Pressable>
                                </View>
                            ))}
                            <TextInput value={creatorDm.email ?? ''} onChangeText={(email) => setCreatorDm((v) => ({ ...v, email }))} placeholder="Creator DM email" autoCapitalize="none" />
                            <TextInput value={creatorDm.telegram ?? ''} onChangeText={(telegram) => setCreatorDm((v) => ({ ...v, telegram }))} placeholder="Creator Telegram" autoCapitalize="none" />
                            <TextInput value={creatorDm.phone ?? ''} onChangeText={(phone) => setCreatorDm((v) => ({ ...v, phone }))} placeholder="Creator phone" keyboardType="phone-pad" />
                        </Field>
                    </View>

                    <View style={{ gap: 14 }}>
                        <Field label="Brand">
                            <TextInput value={companyName} onChangeText={setCompanyName} maxLength={60} placeholder="Company name" />
                            <Pressable
                                onPress={() => setIndustryOpen(true)}
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
                            <TextInput value={websiteUrl} onChangeText={setWebsiteUrl} placeholder="Website URL" autoCapitalize="none" />
                            <TextInput value={brandDm.email ?? ''} onChangeText={(email) => setBrandDm((v) => ({ ...v, email }))} placeholder="Brand DM email" autoCapitalize="none" />
                            <TextInput value={brandDm.telegram ?? ''} onChangeText={(telegram) => setBrandDm((v) => ({ ...v, telegram }))} placeholder="Brand Telegram" autoCapitalize="none" />
                            <TextInput value={brandDm.phone ?? ''} onChangeText={(phone) => setBrandDm((v) => ({ ...v, phone }))} placeholder="Brand phone" keyboardType="phone-pad" />
                        </Field>
                    </View>
                </ScrollView>

                <CtaFooter>
                    <Button title="Save" onPress={save} loading={saving} disabled={saving} size="lg" />
                </CtaFooter>

                <SearchableSheet
                    visible={countryOpen}
                    title="Country"
                    options={COUNTRIES}
                    value={country ?? 'GLOBAL'}
                    onSelect={(value) => setCountryState(value === 'GLOBAL' ? null : value)}
                    onClose={() => setCountryOpen(false)}
                />
                <SearchableSheet
                    visible={industryOpen}
                    title="Industry"
                    options={industryOptions}
                    value={industry}
                    onSelect={setIndustry}
                    onClose={() => setIndustryOpen(false)}
                />
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

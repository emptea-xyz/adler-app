import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react-native';
import { ProfileGate } from '@/components/base/ProfileGate';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { SearchableSheet, type SearchableSheetOption } from '@/components/ui/SearchableSheet';
import TextInput from '@/components/ui/TextInput';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { qk } from '@/lib/constants/queryKeys';
import { getListing, updateGig } from '@/lib/services/listingsService';
import { parseSolAmount } from '@/lib/utils/formatNumber';
import { toast } from '@/lib/utils/toast';
import { CATEGORY_LABEL, LISTING_CATEGORIES, type Gig, type ListingCategory } from '@/lib/types/listing';

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 1000;
const REQUIREMENTS_MAX = 1000;
const PRICE_MAX_SOL = 10000;
const AMOUNT_MAX_LEN = 10;

function validate(input: {
    title: string;
    description: string;
    budget: string;
    requirements: string;
}): string | null {
    const titleLen = input.title.trim().length;
    if (titleLen < 1 || titleLen > TITLE_MAX) return `Title must be 1-${TITLE_MAX} characters.`;
    const descLen = input.description.trim().length;
    if (descLen < 1 || descLen > DESCRIPTION_MAX) return `Description must be 1-${DESCRIPTION_MAX} characters.`;
    if (input.requirements.trim().length > REQUIREMENTS_MAX) return `Requirements must be ${REQUIREMENTS_MAX} characters or less.`;
    const amount = parseSolAmount(input.budget);
    if (amount === null || amount <= 0 || amount > PRICE_MAX_SOL) return `Budget must be > 0 and <= ${PRICE_MAX_SOL} SOL.`;
    return null;
}

export default function EditGigScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const { profile } = useUser();
    const queryClient = useQueryClient();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [requirements, setRequirements] = useState('');
    const [category, setCategory] = useState<ListingCategory>('general');
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [bootstrapped, setBootstrapped] = useState(false);

    const gigQuery = useQuery({
        queryKey: id ? qk.listings.detail('gig', id) : ['listings', 'detail', 'gig', 'unknown'],
        enabled: !!id,
        queryFn: async () => {
            const row = await getListing('gig', id!);
            return row?.kind === 'gig' ? (row as Gig) : null;
        },
    });

    const gig = gigQuery.data;

    useEffect(() => {
        if (!gig || bootstrapped) return;
        setTitle(gig.title);
        setDescription(gig.description);
        setBudget(String(gig.budgetSol));
        setRequirements(gig.requirements);
        setCategory(gig.category);
        setBootstrapped(true);
    }, [gig, bootstrapped]);

    const categoryOptions = useMemo<readonly SearchableSheetOption[]>(
        () => LISTING_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
        [],
    );

    const save = async () => {
        if (!gig || !profile) return;
        if (gig.brandId !== profile.id) {
            toast.error('Only the brand owner can edit this gig.');
            return;
        }
        const error = validate({ title, description, budget, requirements });
        if (error) {
            toast.error(error);
            return;
        }
        const amount = parseSolAmount(budget);
        if (amount === null) {
            toast.error('Budget is invalid.');
            return;
        }

        setSaving(true);
        try {
            await updateGig(gig.id, {
                title: title.trim(),
                description: description.trim(),
                budgetSol: amount,
                requirements: requirements.trim(),
                category,
            });
            queryClient.invalidateQueries({ queryKey: qk.listings.detail('gig', gig.id) });
            queryClient.invalidateQueries({ queryKey: qk.listings.byOwner('gig', gig.brandId) });
            queryClient.invalidateQueries({ queryKey: qk.listings.list('gig', null) });
            toast.success('Gig updated');
            router.replace(`/gig/${gig.id}`);
        } catch (err: any) {
            toast.error(err?.message ?? 'Could not update gig');
            setSaving(false);
        }
    };

    return (
        <ProfileGate require="brand">
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="Edit gig" onBack={() => router.back()} />
                    {gigQuery.isLoading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator color={theme[950]} />
                        </View>
                    ) : !gig ? (
                        <View className="flex-1 items-center justify-center px-4">
                            <ThemedText type="body-md" style={{ color: theme[500] }}>
                                Gig not found.
                            </ThemedText>
                        </View>
                    ) : (
                        <>
                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{
                                    paddingHorizontal: 16,
                                    paddingTop: 16,
                                    paddingBottom: 132,
                                    gap: 22,
                                }}
                            >
                                <View style={{ gap: 8 }}>
                                    <SectionLabel label="Title" />
                                    <TextInput value={title} onChangeText={setTitle} maxLength={TITLE_MAX} />
                                </View>

                                <View style={{ gap: 8 }}>
                                    <SectionLabel label="Description" />
                                    <TextInput
                                        value={description}
                                        onChangeText={setDescription}
                                        maxLength={DESCRIPTION_MAX}
                                        multiline
                                        style={{ minHeight: 120, textAlignVertical: 'top' }}
                                    />
                                </View>

                                <View style={{ gap: 8 }}>
                                    <SectionLabel label="Budget (SOL)" />
                                    <TextInput
                                        value={budget}
                                        onChangeText={setBudget}
                                        maxLength={AMOUNT_MAX_LEN}
                                        keyboardType="decimal-pad"
                                    />
                                </View>

                                <View style={{ gap: 8 }}>
                                    <SectionLabel label="Category" />
                                    <Pressable
                                        onPress={() => setCategoryOpen(true)}
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
                                        <ThemedText type="body-md-semibold">{CATEGORY_LABEL[category]}</ThemedText>
                                        <ChevronDown size={18} color={theme[500]} />
                                    </Pressable>
                                </View>

                                <View style={{ gap: 8 }}>
                                    <SectionLabel label="Requirements" />
                                    <TextInput
                                        value={requirements}
                                        onChangeText={setRequirements}
                                        maxLength={REQUIREMENTS_MAX}
                                        multiline
                                        style={{ minHeight: 110, textAlignVertical: 'top' }}
                                    />
                                </View>
                            </ScrollView>

                            <CtaFooter>
                                <Button title="Save changes" onPress={save} loading={saving} disabled={saving} size="lg" />
                            </CtaFooter>

                            <SearchableSheet
                                visible={categoryOpen}
                                title="Category"
                                options={categoryOptions}
                                value={category}
                                onSelect={(value) => setCategory(value as ListingCategory)}
                                onClose={() => setCategoryOpen(false)}
                            />
                        </>
                    )}
                </SafeAreaView>
            </ThemedView>
        </ProfileGate>
    );
}

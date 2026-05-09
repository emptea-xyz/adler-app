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
import { getListing, updateService } from '@/lib/services/listingsService';
import { parseSolAmount } from '@/lib/utils/formatNumber';
import { toast } from '@/lib/utils/toast';
import { CATEGORY_LABEL, LISTING_CATEGORIES, type ListingCategory, type Service } from '@/lib/types/listing';

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 1000;
const PRICE_MAX_SOL = 10000;
const AMOUNT_MAX_LEN = 10;

function validate(input: {
    title: string;
    description: string;
    price: string;
}): string | null {
    const titleLen = input.title.trim().length;
    if (titleLen < 1 || titleLen > TITLE_MAX) return `Title must be 1-${TITLE_MAX} characters.`;
    const descLen = input.description.trim().length;
    if (descLen < 1 || descLen > DESCRIPTION_MAX) return `Description must be 1-${DESCRIPTION_MAX} characters.`;
    const amount = parseSolAmount(input.price);
    if (amount === null || amount <= 0 || amount > PRICE_MAX_SOL) return `Price must be > 0 and <= ${PRICE_MAX_SOL} SOL.`;
    return null;
}

export default function EditServiceScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const { profile } = useUser();
    const queryClient = useQueryClient();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState<ListingCategory>('general');
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [bootstrapped, setBootstrapped] = useState(false);

    const serviceQuery = useQuery({
        queryKey: id ? qk.listings.detail('service', id) : ['listings', 'detail', 'service', 'unknown'],
        enabled: !!id,
        queryFn: async () => {
            const row = await getListing('service', id!);
            return row?.kind === 'service' ? (row as Service) : null;
        },
    });

    const service = serviceQuery.data;

    useEffect(() => {
        if (!service || bootstrapped) return;
        setTitle(service.title);
        setDescription(service.description);
        setPrice(String(service.priceSol));
        setCategory(service.category);
        setBootstrapped(true);
    }, [service, bootstrapped]);

    const categoryOptions = useMemo<readonly SearchableSheetOption[]>(
        () => LISTING_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
        [],
    );

    const save = async () => {
        if (!service || !profile) return;
        if (service.sellerId !== profile.id) {
            toast.error('Only the service owner can edit this listing.');
            return;
        }
        const error = validate({ title, description, price });
        if (error) {
            toast.error(error);
            return;
        }
        const amount = parseSolAmount(price);
        if (amount === null) {
            toast.error('Price is invalid.');
            return;
        }

        setSaving(true);
        try {
            await updateService(service.id, {
                title: title.trim(),
                description: description.trim(),
                priceSol: amount,
                category,
            });
            queryClient.invalidateQueries({ queryKey: qk.listings.detail('service', service.id) });
            queryClient.invalidateQueries({ queryKey: qk.listings.byOwner('service', service.sellerId) });
            queryClient.invalidateQueries({ queryKey: qk.listings.list('service', null) });
            toast.success('Service updated');
            router.replace(`/service/${service.id}`);
        } catch (err: any) {
            toast.error(err?.message ?? 'Could not update service');
            setSaving(false);
        }
    };

    return (
        <ProfileGate require="creator">
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="Edit service" onBack={() => router.back()} />
                    {serviceQuery.isLoading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator color={theme[950]} />
                        </View>
                    ) : !service ? (
                        <View className="flex-1 items-center justify-center px-4">
                            <ThemedText type="body-md" style={{ color: theme[500] }}>
                                Service not found.
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
                                    <SectionLabel label="Price (SOL)" />
                                    <TextInput
                                        value={price}
                                        onChangeText={setPrice}
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
                            </ScrollView>

                            <CtaFooter helperText="Text edits stay here; replacing video starts a fresh studio clip.">
                                <View style={{ gap: 10 }}>
                                    <Button
                                        title="Replace video in Studio"
                                        onPress={() => router.push('/studio/camera')}
                                        disabled={saving}
                                        size="lg"
                                        variant="secondary"
                                    />
                                    <Button title="Save changes" onPress={save} loading={saving} disabled={saving} size="lg" />
                                </View>
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

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react-native';
import { ProfileGate } from '@/components/base/ProfileGate';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ImagePickerRow } from '@/components/features/create/ImagePickerRow';
import { Button } from '@/components/ui/Button';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { SearchableSheet, type SearchableSheetOption } from '@/components/ui/SearchableSheet';
import TextInput from '@/components/ui/TextInput';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { FEED_KEYS, qk } from '@/lib/constants/queryKeys';
import { createService } from '@/lib/services/listingsService';
import { compressImageForUpload } from '@/lib/services/imageUploadService';
import { uploadListingMedia } from '@/lib/services/listingMediaUploadService';
import { parseSolAmount } from '@/lib/utils/formatNumber';
import { toast } from '@/lib/utils/toast';
import { CATEGORY_LABEL, LISTING_CATEGORIES, type ListingCategory } from '@/lib/types/listing';

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 1000;
const PRICE_MAX_SOL = 10000;
const AMOUNT_MAX_LEN = 10;
const MEDIA_MAX = 5;

type ServiceForm = {
    title: string;
    description: string;
    price: string;
    category: ListingCategory;
    mediaUris: string[];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View style={{ gap: 8 }}>
            <SectionLabel label={label} />
            {children}
        </View>
    );
}

function validate(form: ServiceForm): string | null {
    const titleLen = form.title.trim().length;
    if (titleLen < 1 || titleLen > TITLE_MAX) return `Title must be 1-${TITLE_MAX} characters.`;
    const descLen = form.description.trim().length;
    if (descLen < 1 || descLen > DESCRIPTION_MAX) return `Description must be 1-${DESCRIPTION_MAX} characters.`;
    const amount = parseSolAmount(form.price);
    if (amount === null || amount <= 0 || amount > PRICE_MAX_SOL) {
        return `Price must be > 0 and <= ${PRICE_MAX_SOL} SOL.`;
    }
    if (form.mediaUris.length > MEDIA_MAX) return `Add up to ${MEDIA_MAX} media files.`;
    return null;
}

export default function NewServiceScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { profile } = useUser();
    const queryClient = useQueryClient();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState<ListingCategory>('general');
    const [mediaUris, setMediaUris] = useState<string[]>([]);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const categoryOptions = useMemo<readonly SearchableSheetOption[]>(
        () => LISTING_CATEGORIES.map((id) => ({
            value: id,
            label: CATEGORY_LABEL[id],
        })),
        [],
    );

    const onPublish = async () => {
        if (!profile) return;
        const form: ServiceForm = {
            title,
            description,
            price,
            category,
            mediaUris,
        };
        const error = validate(form);
        if (error) {
            toast.error(error);
            return;
        }

        const amount = parseSolAmount(form.price);
        if (amount === null) {
            toast.error('Price is invalid.');
            return;
        }

        setSaving(true);
        try {
            const mediaUrls: string[] = [];
            for (const uri of mediaUris) {
                const compressedUri = await compressImageForUpload(uri, 1600);
                const result = await uploadListingMedia({
                    kind: 'service',
                    uid: profile.id,
                    uri: compressedUri,
                    contentType: 'image/jpeg',
                });
                mediaUrls.push(result.url);
            }

            const id = await createService({
                title: form.title.trim(),
                description: form.description.trim(),
                category: form.category,
                priceSol: amount,
                ownerHandle: profile.username,
                ownerDisplayName: profile.displayName,
                ownerAvatarUrl: profile.avatarUrl,
                mediaUrls,
            });

            queryClient.invalidateQueries({ queryKey: FEED_KEYS.browse() });
            queryClient.invalidateQueries({ queryKey: FEED_KEYS.browse({ kind: 'service' }) });
            queryClient.invalidateQueries({ queryKey: qk.listings.byOwner('service', profile.id) });

            toast.success('Service published');
            router.replace(`/service/${id}`);
        } catch (err: any) {
            toast.error(err?.message ?? 'Could not publish service');
            setSaving(false);
        }
    };

    return (
        <ProfileGate require="creator">
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="List service" onBack={() => router.back()} />
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
                        <Field label="Title">
                            <TextInput
                                value={title}
                                onChangeText={setTitle}
                                maxLength={TITLE_MAX}
                                placeholder="Short-form product demo package"
                            />
                            <ThemedText type="caption" align="right">
                                {title.trim().length}/{TITLE_MAX}
                            </ThemedText>
                        </Field>

                        <Field label="Description">
                            <TextInput
                                value={description}
                                onChangeText={setDescription}
                                maxLength={DESCRIPTION_MAX}
                                multiline
                                placeholder="Deliverables, hooks, usage scope, turnaround..."
                                style={{ minHeight: 120, textAlignVertical: 'top' }}
                            />
                            <ThemedText type="caption" align="right">
                                {description.trim().length}/{DESCRIPTION_MAX}
                            </ThemedText>
                        </Field>

                        <Field label="Price (SOL)">
                            <TextInput
                                value={price}
                                onChangeText={setPrice}
                                placeholder="0.75"
                                maxLength={AMOUNT_MAX_LEN}
                                keyboardType="decimal-pad"
                            />
                        </Field>

                        <Field label="Category">
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
                        </Field>

                        <Field label="Media (optional)">
                            <ImagePickerRow
                                values={mediaUris}
                                onChange={setMediaUris}
                                max={MEDIA_MAX}
                                disabled={saving}
                            />
                        </Field>
                    </ScrollView>

                    <CtaFooter helperText="Video studio integration lands in the next authoring slice.">
                        <Button
                            title="Publish service"
                            onPress={onPublish}
                            loading={saving}
                            disabled={saving}
                            size="lg"
                        />
                    </CtaFooter>

                    <SearchableSheet
                        visible={categoryOpen}
                        title="Category"
                        options={categoryOptions}
                        value={category}
                        onSelect={(value) => setCategory(value as ListingCategory)}
                        onClose={() => setCategoryOpen(false)}
                    />
                </SafeAreaView>
            </ThemedView>
        </ProfileGate>
    );
}


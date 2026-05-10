import React, { useState, useEffect } from 'react';
import { View, Image, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { useBounty } from '@/hooks/useBounty';
import { createSubmission } from '@/lib/services/submissionService';
import { qk } from '@/lib/constants/queryKeys';
import { haptic } from '@/lib/utils/haptic';
import { toast } from '@/lib/utils/toast';

export default function SubmitScreen() {
    const { id: idParam } = useLocalSearchParams<{ id: string }>();
    const id = String(idParam ?? '');
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const bountyQuery = useBounty(id);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    useEffect(() => {
        // Auto-launch the camera on mount for the fastest path; user can fall
        // back to the library via the secondary button on the preview screen.
        if (photoUri) return;
        (async () => {
            const perm = await ImagePicker.getCameraPermissionsAsync();
            if (!perm.granted) {
                const requested = await ImagePicker.requestCameraPermissionsAsync();
                if (!requested.granted) return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
            });
            if (!result.canceled && result.assets[0]) {
                setPhotoUri(result.assets[0].uri);
            }
        })().catch(() => null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pickFromLibrary = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const retake = async () => {
        setPhotoUri(null);
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const onConfirm = async () => {
        if (!photoUri || !id) return;
        setPending(true);
        try {
            haptic('medium');
            await createSubmission({ bountyId: id, photoUri });
            haptic('heavy');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: qk.submissions.byBounty(id) }),
                queryClient.invalidateQueries({ queryKey: qk.bounties.detail(id) }),
            ]);
            toast.success('Submitted. The verifier is checking your photo.');
            router.back();
        } catch (err) {
            haptic('error');
            toast.error(err instanceof Error ? err.message : 'Could not submit');
        } finally {
            setPending(false);
        }
    };

    const bounty = bountyQuery.data;

    return (
        <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
            <ScreenHeader title="Submit" />
            {bounty ? (
                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    <ThemedText type="caption-semibold" style={{ color: theme[500] }}>PROMPT</ThemedText>
                    <ThemedText type="body-md" style={{ color: theme[800], marginTop: 4 }} numberOfLines={3}>
                        {bounty.prompt}
                    </ThemedText>
                </View>
            ) : null}

            <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
                {photoUri ? (
                    <View style={{ position: 'relative' }}>
                        <Image
                            source={{ uri: photoUri }}
                            style={{ width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: theme[100] }}
                        />
                        <Pressable
                            onPress={() => setPhotoUri(null)}
                            style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: theme[950],
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <X size={16} color={theme[50]} />
                        </Pressable>
                    </View>
                ) : (
                    <View style={{ alignItems: 'center', gap: 16 }}>
                        <ThemedText type="body-md" style={{ color: theme[500], textAlign: 'center' }}>
                            Take a photo or pick one from your library.
                        </ThemedText>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Button
                                variant="primary"
                                size="lg"
                                title="Open camera"
                                leftIcon={<Camera size={18} color={theme[50]} />}
                                onPress={retake}
                            />
                            <Button
                                variant="secondary"
                                size="lg"
                                title="Library"
                                leftIcon={<ImageIcon size={18} color={theme[950]} />}
                                onPress={pickFromLibrary}
                            />
                        </View>
                    </View>
                )}
            </View>

            {photoUri ? (
                <View
                    style={{
                        padding: 16,
                        paddingBottom: 16 + insets.bottom,
                        backgroundColor: theme[50],
                        gap: 8,
                    }}
                >
                    <Button
                        size="lg"
                        variant="primary"
                        title={pending ? 'Submitting…' : 'Confirm submission'}
                        loading={pending}
                        disabled={pending}
                        onPress={onConfirm}
                    />
                    <Button
                        size="default"
                        variant="tertiary"
                        title="Pick another"
                        onPress={pickFromLibrary}
                        disabled={pending}
                    />
                </View>
            ) : null}
        </ThemedView>
    );
}

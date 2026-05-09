import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, RefreshCw } from 'lucide-react-native';
import { ProfileGate } from '@/components/base/ProfileGate';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import { CtaFooter } from '@/components/ui/CtaFooter';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/lib/utils/toast';

const MAX_DURATION_SECONDS = 60;

function normalizeVideoAsset(asset: ImagePicker.ImagePickerAsset) {
    return {
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'video/mp4',
        durationMs: String(asset.duration ?? 0),
        width: String(asset.width ?? 0),
        height: String(asset.height ?? 0),
        fileSize: String(asset.fileSize ?? 0),
    };
}

export default function StudioCameraScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const [cameraType, setCameraType] = useState<ImagePicker.CameraType>(ImagePicker.CameraType.back);
    const [busy, setBusy] = useState(false);

    const proceedToEdit = (asset: ImagePicker.ImagePickerAsset) => {
        const durationMs = asset.duration ?? 0;
        if (durationMs > MAX_DURATION_SECONDS * 1000) {
            toast.error(`Video must be ${MAX_DURATION_SECONDS}s or shorter`);
            return;
        }
        router.push({
            pathname: '/studio/edit',
            params: normalizeVideoAsset(asset),
        });
    };

    const recordVideo = async () => {
        setBusy(true);
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                toast.error('Camera access denied');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['videos'],
                quality: 1,
                videoMaxDuration: MAX_DURATION_SECONDS,
                cameraType,
            });
            if (result.canceled || !result.assets[0]) return;
            proceedToEdit(result.assets[0]);
        } catch (err: any) {
            toast.error(err?.message ?? 'Camera failed');
        } finally {
            setBusy(false);
        }
    };

    const pickFromLibrary = async () => {
        setBusy(true);
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                toast.error('Photo library access denied');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['videos'],
                allowsMultipleSelection: false,
                quality: 1,
            });
            if (result.canceled || !result.assets[0]) return;
            proceedToEdit(result.assets[0]);
        } catch (err: any) {
            toast.error(err?.message ?? 'Library picker failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ProfileGate require="creator">
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="Studio camera" onBack={() => router.back()} />
                    <ScrollView
                        contentContainerStyle={{
                            paddingHorizontal: 16,
                            paddingTop: 16,
                            paddingBottom: 128,
                            gap: 18,
                        }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={{ gap: 6 }}>
                            <SectionLabel label="Capture" />
                            <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                Record a single vertical clip (max {MAX_DURATION_SECONDS}s) or import one from your
                                library.
                            </ThemedText>
                        </View>

                        <View style={{ gap: 10 }}>
                            <Button
                                title="Record video"
                                size="lg"
                                onPress={recordVideo}
                                loading={busy}
                                disabled={busy}
                                leftIcon={<Camera size={16} color={theme[50]} />}
                            />
                            <Button
                                title="Import video"
                                size="lg"
                                variant="secondary"
                                onPress={pickFromLibrary}
                                disabled={busy}
                                leftIcon={<ImageIcon size={16} color={theme[950]} />}
                            />
                            <Button
                                title={cameraType === ImagePicker.CameraType.back ? 'Use front camera' : 'Use back camera'}
                                size="lg"
                                variant="secondary"
                                onPress={() =>
                                    setCameraType((prev) =>
                                        prev === ImagePicker.CameraType.back
                                            ? ImagePicker.CameraType.front
                                            : ImagePicker.CameraType.back,
                                    )
                                }
                                disabled={busy}
                                leftIcon={<RefreshCw size={16} color={theme[950]} />}
                            />
                        </View>
                    </ScrollView>
                    <CtaFooter helperText="Native trim and live text placement are the next studio slice.">
                        <View />
                    </CtaFooter>
                </SafeAreaView>
            </ThemedView>
        </ProfileGate>
    );
}

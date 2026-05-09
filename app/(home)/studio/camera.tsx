import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from 'expo-camera';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageIcon, RefreshCw, X, Zap } from 'lucide-react-native';
import { ProfileGate } from '@/components/base/ProfileGate';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import { Neutral } from '@/constants/NeutralColors';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/lib/utils/toast';

const MAX_DURATION_SECONDS = 60;
const MIN_DURATION_MS = 1000;

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
    const cameraRef = useRef<CameraView | null>(null);
    const recordingStartedAt = useRef<number | null>(null);
    const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [torch, setTorch] = useState(false);
    const [recording, setRecording] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => () => {
        if (stopTimer.current) clearTimeout(stopTimer.current);
    }, []);

    const ensureCapturePermissions = async () => {
        const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
        const mic = micPermission?.granted ? micPermission : await requestMicPermission();
        if (!camera.granted || !mic.granted) {
            toast.error('Camera and microphone access are required');
            return false;
        }
        return true;
    };

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

    const startRecording = async () => {
        if (recording || busy) return;
        const ok = await ensureCapturePermissions();
        if (!ok) return;
        const camera = cameraRef.current;
        if (!camera) return;

        setBusy(true);
        setRecording(true);
        recordingStartedAt.current = Date.now();
        stopTimer.current = setTimeout(() => camera.stopRecording(), MAX_DURATION_SECONDS * 1000);

        try {
            const result = await camera.recordAsync({ maxDuration: MAX_DURATION_SECONDS });
            const elapsed = recordingStartedAt.current ? Date.now() - recordingStartedAt.current : 0;
            if (elapsed < MIN_DURATION_MS) {
                toast.error('Hold at least 1s to record');
                return;
            }
            if (!result?.uri) return;
            router.push({
                pathname: '/studio/edit',
                params: {
                    uri: result.uri,
                    mimeType: 'video/mp4',
                    durationMs: String(Math.min(elapsed, MAX_DURATION_SECONDS * 1000)),
                    width: '0',
                    height: '0',
                    fileSize: '0',
                },
            });
        } catch (err: any) {
            toast.error(err?.message ?? 'Recording failed');
        } finally {
            if (stopTimer.current) clearTimeout(stopTimer.current);
            stopTimer.current = null;
            recordingStartedAt.current = null;
            setRecording(false);
            setBusy(false);
        }
    };

    const stopRecording = () => {
        if (!recording) return;
        cameraRef.current?.stopRecording();
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

    const hasPermission = cameraPermission?.granted && micPermission?.granted;

    return (
        <ProfileGate require="creator">
            <ThemedView className="flex-1" style={{ backgroundColor: theme[950] }}>
                <SafeAreaView edges={['top', 'bottom']} className="flex-1">
                    <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 18, gap: 18 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Pressable
                                onPress={() => router.back()}
                                hitSlop={12}
                                accessibilityRole="button"
                                accessibilityLabel="Close studio camera"
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 21,
                                    backgroundColor: theme[900],
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <X size={20} color={theme[50]} />
                            </Pressable>
                            <ThemedText type="body-md-semibold" style={{ color: theme[50] }}>
                                Hold to record
                            </ThemedText>
                            <Pressable
                                onPress={() => setTorch((value) => !value)}
                                hitSlop={12}
                                accessibilityRole="button"
                                accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'}
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 21,
                                    backgroundColor: torch ? theme[50] : theme[900],
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Zap size={19} color={torch ? theme[950] : theme[50]} fill={torch ? theme[950] : 'transparent'} />
                            </Pressable>
                        </View>

                        <View
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <View
                                style={{
                                    width: '100%',
                                    maxWidth: 420,
                                    aspectRatio: 9 / 16,
                                    borderRadius: 18,
                                    overflow: 'hidden',
                                    backgroundColor: theme[900],
                                }}
                            >
                                {hasPermission ? (
                                    <CameraView
                                        ref={cameraRef}
                                        style={{ width: '100%', height: '100%' }}
                                        facing={facing}
                                        enableTorch={torch}
                                        mode="video"
                                    />
                                ) : (
                                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
                                        <ThemedText type="body-md-semibold" align="center" style={{ color: theme[50] }}>
                                            Camera access needed
                                        </ThemedText>
                                        <Button title="Enable camera" size="sm" onPress={ensureCapturePermissions} />
                                    </View>
                                )}
                                {recording ? (
                                    <View
                                        style={{
                                            position: 'absolute',
                                            top: 14,
                                            alignSelf: 'center',
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 999,
                                            backgroundColor: theme[950],
                                        }}
                                    >
                                        <ThemedText type="caption-semibold" style={{ color: Neutral.white }}>
                                            Recording · max {MAX_DURATION_SECONDS}s
                                        </ThemedText>
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Pressable
                                onPress={pickFromLibrary}
                                disabled={busy}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel="Import video from library"
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 26,
                                    backgroundColor: theme[900],
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: busy ? 0.5 : 1,
                                }}
                            >
                                <ImageIcon size={22} color={theme[50]} />
                            </Pressable>

                            <Pressable
                                onPressIn={startRecording}
                                onPressOut={stopRecording}
                                disabled={busy && !recording}
                                accessibilityRole="button"
                                accessibilityLabel="Hold to record video"
                                style={{
                                    width: 86,
                                    height: 86,
                                    borderRadius: 43,
                                    borderWidth: 4,
                                    borderColor: theme[50],
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: busy && !recording ? 0.6 : 1,
                                }}
                            >
                                <View
                                    style={{
                                        width: recording ? 38 : 64,
                                        height: recording ? 38 : 64,
                                        borderRadius: recording ? 8 : 32,
                                        backgroundColor: theme[50],
                                    }}
                                />
                            </Pressable>

                            <Pressable
                                onPress={() => setFacing((value) => (value === 'back' ? 'front' : 'back'))}
                                disabled={recording}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel="Switch camera"
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 26,
                                    backgroundColor: theme[900],
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: recording ? 0.5 : 1,
                                }}
                            >
                                <RefreshCw size={22} color={theme[50]} />
                            </Pressable>
                        </View>
                    </View>
                </SafeAreaView>
            </ThemedView>
        </ProfileGate>
    );
}

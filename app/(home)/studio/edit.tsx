import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import VideoTrim, { showEditor } from 'react-native-video-trim';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Scissors } from 'lucide-react-native';
import { ProfileGate } from '@/components/base/ProfileGate';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import { CtaFooter } from '@/components/ui/CtaFooter';
import TextInput from '@/components/ui/TextInput';
import { Neutral } from '@/constants/NeutralColors';
import { Accent } from '@/constants/ThemePalettes';
import { useTheme } from '@/contexts/ThemeContext';
import { formatSol } from '@/lib/utils/formatNumber';
import { saveStudioDraft } from '@/lib/utils/studioDraft';
import { toast } from '@/lib/utils/toast';
import type { ListingOverlay } from '@/lib/types/listing';

const COLOR_SWATCHES = [Neutral.white, Neutral.black, Accent.pink, Accent.cyan, Accent.lime, Accent.orange] as const;
const MAX_DURATION_MS = 60_000;
const MIN_DURATION_MS = 1_000;
const PREVIEW_HEIGHT = 360;
type TrimFinishEvent = { outputPath: string; startTime: number; endTime: number; duration: number };
type TrimErrorEvent = { message?: string };

function asNumber(input: string | undefined): number {
    if (!input) return 0;
    const value = Number(input);
    return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export default function StudioEditScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const params = useLocalSearchParams<{
        uri?: string;
        mimeType?: string;
        durationMs?: string;
        width?: string;
        height?: string;
        fileSize?: string;
    }>();
    const initialUri = typeof params.uri === 'string' ? params.uri : '';
    const mimeType = typeof params.mimeType === 'string' ? params.mimeType : 'video/mp4';
    const initialDurationMs = asNumber(params.durationMs);
    const width = asNumber(params.width);
    const height = asNumber(params.height);
    const fileSizeBytes = asNumber(params.fileSize);

    const [uri, setUri] = useState(initialUri);
    const [durationMs, setDurationMs] = useState(initialDurationMs);
    const [trimMeta, setTrimMeta] = useState<{ sourceUri: string; startTime: number; endTime: number } | null>(null);
    const [overlayText, setOverlayText] = useState('');
    const [overlayColor, setOverlayColor] = useState<string>(Neutral.white);
    const [overlayScale, setOverlayScale] = useState(1);
    const [overlayPosition, setOverlayPosition] = useState({ x: 0.5, y: 0.5 });
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);
    const liveScale = useSharedValue(1);
    const startScale = useSharedValue(1);

    const player = useVideoPlayer(uri ? { uri } : null, (p) => {
        p.loop = true;
        p.play();
    });

    useEffect(() => {
        liveScale.value = overlayScale;
    }, [liveScale, overlayScale]);

    useEffect(() => {
        const finish = VideoTrim.onFinishTrimming?.(({ outputPath, startTime, endTime, duration }: TrimFinishEvent) => {
            if (!outputPath) return;
            setUri(outputPath);
            setDurationMs(duration > 0 ? duration : Math.max(0, endTime - startTime));
            setTrimMeta({ sourceUri: uri, startTime, endTime });
            toast.success('Trim applied');
        });
        const error = VideoTrim.onError?.(({ message }: TrimErrorEvent) => {
            toast.error(message || 'Trim failed');
        });
        return () => {
            finish?.remove?.();
            error?.remove?.();
        };
    }, [uri]);

    const durationLabel = useMemo(() => `${(durationMs / 1000).toFixed(1)}s`, [durationMs]);
    const sizeLabel = useMemo(() => `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`, [fileSizeBytes]);

    const syncPosition = (nextX: number, nextY: number) => {
        setOverlayPosition({
            x: clamp(0.5 + nextX / 300, 0.08, 0.92),
            y: clamp(0.5 + nextY / PREVIEW_HEIGHT, 0.08, 0.92),
        });
    };

    const syncScale = (nextScale: number) => {
        setOverlayScale(Number(clamp(nextScale, 0.6, 2).toFixed(1)));
    };

    const pan = Gesture.Pan()
        .onBegin(() => {
            startX.value = translateX.value;
            startY.value = translateY.value;
        })
        .onUpdate((event) => {
            translateX.value = clamp(startX.value + event.translationX, -138, 138);
            translateY.value = clamp(startY.value + event.translationY, -150, 150);
        })
        .onFinalize(() => {
            runOnJS(syncPosition)(translateX.value, translateY.value);
        });

    const pinch = Gesture.Pinch()
        .onBegin(() => {
            startScale.value = liveScale.value;
        })
        .onUpdate((event) => {
            liveScale.value = clamp(startScale.value * event.scale, 0.6, 2);
        })
        .onFinalize(() => {
            runOnJS(syncScale)(liveScale.value);
        });

    const overlayStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: liveScale.value },
        ],
    }));

    const openTrimmer = () => {
        if (!uri) return;
        try {
            showEditor(uri, {
                maxDuration: MAX_DURATION_MS,
                minDuration: MIN_DURATION_MS,
                closeWhenFinish: true,
                saveToPhoto: false,
                headerText: 'Trim studio clip',
                saveButtonText: 'Apply',
                cancelButtonText: 'Cancel',
                theme: 'dark',
            });
        } catch (err: any) {
            toast.error(err?.message ?? 'Trim editor unavailable');
        }
    };

    const continueToForm = async () => {
        const text = overlayText.trim();
        const overlay: ListingOverlay | null = text
            ? {
                text,
                color: overlayColor,
                scale: overlayScale,
                x: overlayPosition.x,
                y: overlayPosition.y,
            }
            : null;

        await saveStudioDraft({
            uri,
            contentType: mimeType,
            durationMs,
            width,
            height,
            sizeBytes: fileSizeBytes,
            overlay,
            trim: trimMeta,
            updatedAt: Date.now(),
        }).catch(() => {});

        router.push({
            pathname: '/services/new',
            params: {
                studioMediaUri: uri,
                studioContentType: mimeType,
                studioDurationMs: String(durationMs),
                studioFileSize: String(fileSizeBytes),
                overlayText: text,
                overlayColor,
                overlayScale: String(overlayScale),
                overlayX: String(overlayPosition.x),
                overlayY: String(overlayPosition.y),
            },
        });
    };

    return (
        <ProfileGate require="creator">
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="Studio edit" onBack={() => router.back()} />
                    <ScrollView
                        contentContainerStyle={{
                            paddingHorizontal: 16,
                            paddingTop: 16,
                            paddingBottom: 132,
                            gap: 20,
                        }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={{ gap: 6 }}>
                            <SectionLabel label="Clip" />
                            <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                Ready to publish: {durationLabel} · {width}x{height} · {sizeLabel}
                            </ThemedText>
                            <ThemedText type="caption" style={{ color: theme[400] }} numberOfLines={1}>
                                {uri}
                            </ThemedText>
                        </View>

                        {uri ? (
                            <View
                                style={{
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    backgroundColor: theme[950],
                                    height: PREVIEW_HEIGHT,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <VideoView
                                    player={player}
                                    nativeControls={false}
                                    contentFit="cover"
                                    style={{ width: '100%', height: '100%' }}
                                />
                                {overlayText.trim() ? (
                                    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
                                        <Animated.View
                                            style={[
                                                {
                                                    position: 'absolute',
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 8,
                                                },
                                                overlayStyle,
                                            ]}
                                        >
                                            <ThemedText
                                                type="body-lg-semibold"
                                                style={{
                                                    color: overlayColor,
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {overlayText.trim()}
                                            </ThemedText>
                                        </Animated.View>
                                    </GestureDetector>
                                ) : null}
                            </View>
                        ) : null}

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Button
                                title="Trim"
                                size="sm"
                                variant="secondary"
                                onPress={openTrimmer}
                                disabled={!uri}
                                leftIcon={<Scissors size={15} color={theme[950]} />}
                            />
                            <ThemedText type="body-sm" style={{ color: theme[500], flex: 1 }}>
                                Drag text on the preview; pinch to scale.
                            </ThemedText>
                        </View>

                        <View style={{ gap: 8 }}>
                            <SectionLabel label="Overlay text" />
                            <TextInput
                                value={overlayText}
                                onChangeText={setOverlayText}
                                placeholder="Add text overlay (optional)"
                                maxLength={80}
                            />
                        </View>

                        <View style={{ gap: 8 }}>
                            <SectionLabel label="Overlay color" />
                            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                                {COLOR_SWATCHES.map((swatch) => {
                                    const selected = swatch === overlayColor;
                                    return (
                                        <Pressable
                                            key={swatch}
                                            onPress={() => setOverlayColor(swatch)}
                                            style={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 17,
                                                backgroundColor: swatch,
                                                borderWidth: selected ? 3 : 1,
                                                borderColor: selected ? theme[950] : theme[300],
                                            }}
                                            accessibilityRole="button"
                                            accessibilityLabel="Select overlay color"
                                        />
                                    );
                                })}
                            </View>
                        </View>

                        <View style={{ gap: 8 }}>
                            <SectionLabel label="Overlay scale" />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <Button
                                    title="-"
                                    size="sm"
                                    variant="secondary"
                                    onPress={() => {
                                        setOverlayScale((v) => {
                                            const next = Math.max(0.6, Number((v - 0.1).toFixed(1)));
                                            liveScale.value = next;
                                            return next;
                                        });
                                    }}
                                />
                                <View
                                    style={{
                                        minWidth: 84,
                                        borderRadius: 10,
                                        paddingHorizontal: 12,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: theme[100],
                                    }}
                                >
                                    <ThemedText type="body-sm">{formatSol(overlayScale)}x</ThemedText>
                                </View>
                                <Button
                                    title="+"
                                    size="sm"
                                    variant="secondary"
                                    onPress={() => {
                                        setOverlayScale((v) => {
                                            const next = Math.min(2, Number((v + 0.1).toFixed(1)));
                                            liveScale.value = next;
                                            return next;
                                        });
                                    }}
                                />
                            </View>
                        </View>
                    </ScrollView>
                    <CtaFooter helperText="Next: listing form with clip + overlay metadata attached.">
                        <Button
                            title="Continue"
                            size="lg"
                            disabled={!uri}
                            onPress={continueToForm}
                        />
                    </CtaFooter>
                </SafeAreaView>
            </ThemedView>
        </ProfileGate>
    );
}

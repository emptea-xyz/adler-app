import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const COLOR_SWATCHES = [Neutral.white, Neutral.black, Accent.pink, Accent.cyan, Accent.lime, Accent.orange] as const;

function asNumber(input: string | undefined): number {
    if (!input) return 0;
    const value = Number(input);
    return Number.isFinite(value) ? value : 0;
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
    const uri = typeof params.uri === 'string' ? params.uri : '';
    const mimeType = typeof params.mimeType === 'string' ? params.mimeType : 'video/mp4';
    const durationMs = asNumber(params.durationMs);
    const width = asNumber(params.width);
    const height = asNumber(params.height);
    const fileSizeBytes = asNumber(params.fileSize);

    const [overlayText, setOverlayText] = useState('');
    const [overlayColor, setOverlayColor] = useState<string>(Neutral.white);
    const [overlayScale, setOverlayScale] = useState(1);

    const durationLabel = useMemo(() => `${(durationMs / 1000).toFixed(1)}s`, [durationMs]);
    const sizeLabel = useMemo(() => `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`, [fileSizeBytes]);

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
                                    onPress={() => setOverlayScale((v) => Math.max(0.6, Number((v - 0.1).toFixed(1))))}
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
                                    onPress={() => setOverlayScale((v) => Math.min(2, Number((v + 0.1).toFixed(1))))}
                                />
                            </View>
                        </View>
                    </ScrollView>
                    <CtaFooter helperText="Next: listing form with clip + overlay metadata attached.">
                        <Button
                            title="Continue"
                            size="lg"
                            disabled={!uri}
                            onPress={() =>
                                router.push({
                                    pathname: '/services/new',
                                    params: {
                                        studioMediaUri: uri,
                                        studioContentType: mimeType,
                                        studioDurationMs: String(durationMs),
                                        overlayText: overlayText.trim(),
                                        overlayColor,
                                        overlayScale: String(overlayScale),
                                    },
                                })
                            }
                        />
                    </CtaFooter>
                </SafeAreaView>
            </ThemedView>
        </ProfileGate>
    );
}

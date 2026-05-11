import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import Card from '@/components/ui/Card';
import { useTheme, type ColorScheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';

const OPTIONS: { id: ColorScheme; label: string; description: string }[] = [
    { id: 'system', label: 'System', description: 'Match your device setting.' },
    { id: 'light', label: 'Light', description: 'Always use the light palette.' },
    { id: 'dark', label: 'Dark', description: 'Always use the dark palette.' },
];

export default function AppearanceScreen() {
    const { theme, colorScheme, setColorScheme } = useTheme();
    const router = useRouter();

    const onPick = async (next: ColorScheme) => {
        haptic('light');
        await setColorScheme(next);
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="Appearance" onBack={() => router.back()} />

                <ScrollView contentContainerStyle={{ paddingTop: 16 }}>
                    <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                        <SectionLabel label="Theme" />
                    </View>

                    {OPTIONS.map((opt) => {
                        const selected = colorScheme === opt.id;
                        return (
                            <Card
                                key={opt.id}
                                onPress={() => onPick(opt.id)}
                                variant="border-bottom"
                                className="flex-row items-center justify-between px-screen py-3"
                            >
                                <View style={{ flex: 1, gap: 2 }}>
                                    <ThemedText type="body-md" style={{ color: theme[950] }}>
                                        {opt.label}
                                    </ThemedText>
                                    <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                        {opt.description}
                                    </ThemedText>
                                </View>
                                {selected ? <Icon name="checkmark" color={theme[950]} size={18} weight="semibold" /> : null}
                            </Card>
                        );
                    })}
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

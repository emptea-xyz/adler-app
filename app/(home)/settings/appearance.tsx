import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { toast } from '@/lib/utils/toast';

type ColorScheme = 'system' | 'light' | 'dark';

interface OptionSpec {
    value: ColorScheme;
    label: string;
    description: string;
    icon: IconName;
}

const OPTIONS: OptionSpec[] = [
    {
        value: 'system',
        label: 'System',
        description: 'Match iOS appearance',
        icon: 'iphone',
    },
    {
        value: 'light',
        label: 'Light',
        description: 'Always light',
        icon: 'sun.max.fill',
    },
    {
        value: 'dark',
        label: 'Dark',
        description: 'Always dark',
        icon: 'moon.fill',
    },
];

export default function SettingsAppearanceScreen() {
    const router = useRouter();
    const { theme, colorScheme, setColorScheme } = useTheme();

    const onSelect = async (next: ColorScheme) => {
        if (next === colorScheme) return;
        haptic('light');
        try {
            await setColorScheme(next);
        } catch {
            toast.error('Could not save appearance');
        }
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="Appearance" onBack={() => router.back()} />
                <ScrollView
                    contentContainerStyle={{ paddingTop: 16, paddingBottom: 40, gap: 8 }}
                >
                    <View style={{ paddingHorizontal: 16 }}>
                        <SectionLabel label="Theme" />
                    </View>
                    <View
                        style={{
                            marginHorizontal: 16,
                            backgroundColor: theme[100],
                            borderRadius: 16,
                            overflow: 'hidden',
                        }}
                    >
                        {OPTIONS.map((opt, i) => {
                            const active = opt.value === colorScheme;
                            return (
                                <Pressable
                                    key={opt.value}
                                    onPress={() => onSelect(opt.value)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: active }}
                                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                                >
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 14,
                                            minHeight: 56,
                                            paddingHorizontal: 16,
                                            paddingVertical: 12,
                                            borderBottomWidth: i === OPTIONS.length - 1 ? 0 : 1,
                                            borderBottomColor: theme[200],
                                        }}
                                    >
                                        <Icon name={opt.icon} size={22} color={theme[700]} />
                                        <View style={{ flex: 1 }}>
                                            <ThemedText
                                                type="body-md-semibold"
                                                style={{ color: theme[950] }}
                                            >
                                                {opt.label}
                                            </ThemedText>
                                            <ThemedText
                                                type="caption"
                                                style={{ color: theme[500] }}
                                            >
                                                {opt.description}
                                            </ThemedText>
                                        </View>
                                        {active ? (
                                            <Icon
                                                name="checkmark"
                                                size={18}
                                                color={theme[950]}
                                                weight="semibold"
                                            />
                                        ) : null}
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

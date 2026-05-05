import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Application from 'expo-application';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';

export default function AboutScreen() {
    const { theme } = useTheme();
    const router = useRouter();

    const version = Application.nativeApplicationVersion ?? '—';
    const build = Application.nativeBuildVersion ?? '—';

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="About" onBack={() => router.back()} />

                <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, gap: 16 }}>
                    <View>
                        <SectionLabel label="App" />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                            <ThemedText type="body-md" style={{ color: theme[700] }}>Version</ThemedText>
                            <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>{version}</ThemedText>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                            <ThemedText type="body-md" style={{ color: theme[700] }}>Build</ThemedText>
                            <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>{build}</ThemedText>
                        </View>
                    </View>

                    <ThemedText type="body-sm" style={{ color: theme[500], marginTop: 16 }}>
                        Adler is a two-sided UGC marketplace settled on Solana. Built by emptea.
                    </ThemedText>
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

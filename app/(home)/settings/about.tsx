import React from 'react';
import { View } from 'react-native';
import * as Application from 'expo-application';
import { ThemedText } from '@/components/base/ThemedText';
import { SettingsScreenLayout } from '@/components/base/SettingsScreenLayout';
import { SectionLabel } from '@/components/base/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';

export default function AboutScreen() {
    const { theme } = useTheme();

    const version = Application.nativeApplicationVersion ?? '—';
    const build = Application.nativeBuildVersion ?? '—';

    return (
        <SettingsScreenLayout
            title="About"
            contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 24, gap: 16 }}
        >
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
        </SettingsScreenLayout>
    );
}

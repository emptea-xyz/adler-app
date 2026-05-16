import React, { type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';

interface SettingsScreenLayoutProps {
    title: string;
    onBack?: () => void;
    /** When true, renders a centered ActivityIndicator instead of the ScrollView. */
    loading?: boolean;
    /** Override the ScrollView contentContainerStyle. Defaults to list-style padding. */
    contentContainerStyle?: StyleProp<ViewStyle>;
    children: ReactNode;
}

const DEFAULT_CONTENT_STYLE: ViewStyle = {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
};

/**
 * Shared shell for settings screens: ThemedView + top-safe area + ScreenHeader +
 * ScrollView. Matches the conventions in `.claude/rules/architecture.md` (List
 * vs. Form padding is controlled by `contentContainerStyle`).
 */
export function SettingsScreenLayout({
    title,
    onBack,
    loading = false,
    contentContainerStyle = DEFAULT_CONTENT_STYLE,
    children,
}: SettingsScreenLayoutProps) {
    const { theme } = useTheme();
    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title={title} onBack={onBack} />
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={theme[950]} />
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={contentContainerStyle}>{children}</ScrollView>
                )}
            </SafeAreaView>
        </ThemedView>
    );
}

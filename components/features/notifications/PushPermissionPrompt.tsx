import React from 'react';
import { View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';

interface PushPermissionPromptProps {
    visible: boolean;
    loading?: boolean;
    onEnable: () => void;
    onSkip: () => void;
}

export function PushPermissionPrompt({
    visible,
    loading = false,
    onEnable,
    onSkip,
}: PushPermissionPromptProps) {
    const { theme } = useTheme();

    return (
        <BottomSheet
            visible={visible}
            onClose={onSkip}
            title="Notifications"
            height={330}
            dismissible={!loading}
        >
            <View style={{ flex: 1, justifyContent: 'space-between', gap: 24 }}>
                <View style={{ gap: 14, alignItems: 'flex-start' }}>
                    <View
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: theme[100],
                        }}
                    >
                        <Bell size={22} color={theme[950]} />
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="h5" style={{ color: theme[950] }}>
                            Get notified when buyers reach out
                        </ThemedText>
                        <ThemedText type="body-md" style={{ color: theme[500] }}>
                            Adler can send order, message, and application updates as they happen.
                        </ThemedText>
                    </View>
                </View>
                <View style={{ gap: 10 }}>
                    <Button title="Enable" onPress={onEnable} loading={loading} size="lg" />
                    <Button title="Not now" onPress={onSkip} disabled={loading} variant="inline" size="lg" />
                </View>
            </View>
        </BottomSheet>
    );
}

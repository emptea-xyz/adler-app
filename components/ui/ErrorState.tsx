import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon } from '@/components/ui/Icon';
import { Status } from '@/constants/StatusColors';
import { useTheme } from '@/contexts/ThemeContext';
import * as Clipboard from 'expo-clipboard';

interface ErrorStateProps {
    /** Error message to display */
    message?: string;
    /** Retry callback */
    onRetry?: () => void;
}

export function ErrorState({
    message = 'Something went wrong',
    onRetry,
}: ErrorStateProps) {
    const { theme } = useTheme();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await Clipboard.setStringAsync(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <View className="flex-1 items-center justify-center p-8">
            <Icon
                name="exclamationmark.circle.fill"
                size={48}
                color={Status.error}
            />
            <ThemedText type="body-md" align="center" className="mt-4" style={{ color: theme[500] }}>
                {message}
            </ThemedText>
            <View className="flex-row items-center gap-4 mt-6">
                {onRetry && (
                    <Pressable
                        onPress={onRetry}
                        className="flex-row items-center gap-2 px-4 py-2 rounded-lg"
                        style={{ backgroundColor: theme[100] }}
                    >
                        <Icon
                            name="arrow.clockwise"
                            size={16}
                            color={theme[700]}
                        />
                        <ThemedText type="body-sm-semibold">Try again</ThemedText>
                    </Pressable>
                )}
                <Pressable
                    onPress={handleCopy}
                    className="flex-row items-center gap-2 px-4 py-2 rounded-lg"
                    style={{ backgroundColor: theme[100] }}
                >
                    {copied ? (
                        <Icon name="checkmark" size={16} color={theme[700]} weight="semibold" />
                    ) : (
                        <Icon name="doc.on.doc" size={16} color={theme[700]} />
                    )}
                    <ThemedText type="body-sm-semibold">{copied ? 'Copied' : 'Copy Error'}</ThemedText>
                </Pressable>
            </View>
        </View>
    );
}

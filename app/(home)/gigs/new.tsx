import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BriefcaseBusiness } from 'lucide-react-native';
import { ProfileGate } from '@/components/base/ProfileGate';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { ThemedView } from '@/components/base/ThemedView';
import EmptyState from '@/components/ui/EmptyState';
import { useTheme } from '@/contexts/ThemeContext';

export default function NewGigScreen() {
    const { theme } = useTheme();

    return (
        <ProfileGate require="brand">
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="Post gig" />
                    <View className="flex-1 px-4">
                        <EmptyState
                            icon={<BriefcaseBusiness size={28} color={theme[400]} />}
                            title="Post gig soon"
                            description="Gig authoring is being finished for this build."
                        />
                    </View>
                </SafeAreaView>
            </ThemedView>
        </ProfileGate>
    );
}

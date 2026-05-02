import React, { useCallback } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut, Wallet, UserCog } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/lib/utils/toast';

function Row({
    icon,
    title,
    onPress,
    destructive,
}: {
    icon: React.ReactNode;
    title: string;
    onPress: () => void;
    destructive?: boolean;
}) {
    const { theme } = useTheme();
    return (
        <Card
            onPress={onPress}
            variant="border-bottom"
            className="flex-row items-center justify-between px-screen py-3"
        >
            <View className="flex-row items-center gap-3">
                {icon}
                <ThemedText
                    type="body-md"
                    style={destructive ? { color: '#DC143C' } : { color: theme[950] }}
                >
                    {title}
                </ThemedText>
            </View>
            <ChevronRight color={theme[400]} size={18} />
        </Card>
    );
}

export default function SettingsIndexScreen() {
    const { signOut } = useAuth();
    const { theme } = useTheme();
    const router = useRouter();

    const onSignOut = useCallback(async () => {
        try {
            await signOut();
            router.replace('/(auth)/sign-in');
        } catch {
            toast.error('Sign-out failed');
        }
    }, [signOut, router]);

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="Settings" onBack={() => router.back()} />

                <ScrollView contentContainerStyle={{ paddingTop: 16 }}>
                    <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                        <SectionLabel label="Account" />
                    </View>
                    <Row
                        icon={<Wallet color={theme[700]} size={18} />}
                        title="Wallet"
                        onPress={() => router.push('/settings/wallet')}
                    />
                    <Row
                        icon={<UserCog color={theme[700]} size={18} />}
                        title="Switch role"
                        onPress={() => router.push('/settings/role')}
                    />

                    <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
                        <SectionLabel label="Session" />
                    </View>
                    <Row
                        icon={<LogOut color="#DC143C" size={18} />}
                        title="Sign out"
                        onPress={onSignOut}
                        destructive
                    />
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

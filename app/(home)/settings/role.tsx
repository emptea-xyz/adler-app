import React, { useCallback, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { setRole } from '@/lib/services/profileService';
import { haptic } from '@/lib/utils/haptic';
import { toast } from '@/lib/utils/toast';
import type { UserRole } from '@/types/marketplace';

const ROLES: { id: UserRole; title: string; description: string }[] = [
    {
        id: 'creator',
        title: 'Creator',
        description: 'Sell content packages, apply to gigs.',
    },
    {
        id: 'brand',
        title: 'Brand',
        description: 'Buy packages, post gigs.',
    },
];

export default function RoleSwitchScreen() {
    const { user } = useAuth();
    const { profile, refreshProfile } = useUser();
    const { theme } = useTheme();
    const router = useRouter();
    const [selected, setSelected] = useState<UserRole | null>(profile?.role ?? null);
    const [submitting, setSubmitting] = useState(false);

    const onConfirm = useCallback(async () => {
        if (!user || !selected || selected === profile?.role) return;
        setSubmitting(true);
        try {
            await setRole(user.id, selected);
            await refreshProfile();
            toast.success('Role updated');
            router.back();
        } catch (err: any) {
            toast.error(err?.message ?? 'Failed to update role');
            setSubmitting(false);
        }
    }, [user, selected, profile?.role, refreshProfile, router]);

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="Switch role" onBack={() => router.back()} />

                <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
                    <ThemedText type="body-sm" style={{ color: theme[500] }}>
                        Switching role changes which tabs and flows you see. Your wallet, listings, and history stay intact.
                    </ThemedText>

                    <View className="gap-3">
                        {ROLES.map((r) => {
                            const isActive = selected === r.id;
                            return (
                                <Pressable
                                    key={r.id}
                                    onPress={() => {
                                        haptic('light');
                                        setSelected(r.id);
                                    }}
                                    className="rounded-card p-4 border-2"
                                    style={{
                                        borderColor: isActive ? theme[950] : theme[200],
                                        backgroundColor: isActive ? theme[100] : 'transparent',
                                    }}
                                >
                                    <ThemedText type="body-lg-semibold">{r.title}</ThemedText>
                                    <ThemedText type="body-sm" className="mt-1" style={{ color: theme[500] }}>
                                        {r.description}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>

                    <Button
                        title="Save"
                        onPress={onConfirm}
                        disabled={!selected || selected === profile?.role || submitting}
                        loading={submitting}
                        variant="primary"
                        size="lg"
                    />
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

import React, { useCallback, useState } from 'react';
import { View, ScrollView, Linking, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { SignOutSheet } from '@/components/features/account/SignOutSheet';
import { DeleteAccountSheet } from '@/components/features/account/DeleteAccountSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { DESTRUCTIVE } from '@/constants/StatusColors';
import { deleteAccount } from '@/lib/services/privyAuthService';
import { toast } from '@/lib/utils/toast';

const TERMS_URL = 'https://emptea.xyz/terms-of-service';
const PRIVACY_URL = 'https://emptea.xyz/privacy-policy';
const SUPPORT_EMAIL = 'support@emptea.xyz';

type TrailingIcon = 'chevron' | 'external' | 'none';

interface RowSpec {
    icon: IconName;
    title: string;
    onPress: () => void;
    trailing?: TrailingIcon;
    destructive?: boolean;
}

function SettingsRow({
    spec,
    isLast,
}: {
    spec: RowSpec;
    isLast: boolean;
}) {
    const { theme } = useTheme();
    const tone = spec.destructive ? DESTRUCTIVE : theme[950];
    const iconTone = spec.destructive ? DESTRUCTIVE : theme[700];
    const trailing = spec.trailing ?? 'chevron';
    return (
        <Pressable
            onPress={spec.onPress}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 56,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: theme[200],
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Icon name={spec.icon} color={iconTone} size={22} />
                    <ThemedText type="body-md-semibold" style={{ color: tone }}>
                        {spec.title}
                    </ThemedText>
                </View>
                {trailing === 'chevron' ? (
                    <Icon name="chevron.right" color={theme[400]} size={18} />
                ) : trailing === 'external' ? (
                    <Icon name="arrow.up.forward.square" color={theme[400]} size={16} />
                ) : null}
            </View>
        </Pressable>
    );
}

function SettingsGroup({ rows }: { rows: RowSpec[] }) {
    const { theme } = useTheme();
    return (
        <View
            style={{
                backgroundColor: theme[100],
                borderRadius: 16,
                overflow: 'hidden',
            }}
        >
            {rows.map((row, i) => (
                <SettingsRow key={row.title} spec={row} isLast={i === rows.length - 1} />
            ))}
        </View>
    );
}

export default function SettingsIndexScreen() {
    const { signOut } = useAuth();
    const router = useRouter();
    const [signOutSheet, setSignOutSheet] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [deleteSheet, setDeleteSheet] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const onSignOut = useCallback(async () => {
        setSigningOut(true);
        try {
            await signOut();
            setSignOutSheet(false);
            router.replace('/(auth)/sign-in');
        } catch {
            toast.error('Sign-out failed');
            setSigningOut(false);
        }
    }, [signOut, router]);

    const onDeleteAccount = useCallback(async () => {
        setDeleting(true);
        try {
            await deleteAccount();
            await signOut().catch(() => null);
            toast.success('Account deleted');
            setDeleteSheet(false);
            router.replace('/(auth)/sign-in');
        } catch (err: any) {
            toast.error(err?.message ?? 'Account deletion failed');
            setDeleting(false);
        }
    }, [signOut, router]);

    const accountRows: RowSpec[] = [
        {
            icon: 'person.crop.circle.fill',
            title: 'Profile',
            onPress: () => router.push('/settings/profile'),
        },
        {
            icon: 'rectangle.portrait.and.arrow.right.fill',
            title: 'Account',
            onPress: () => router.push('/settings/account'),
        },
        {
            icon: 'sun.max.fill',
            title: 'Appearance',
            onPress: () => router.push('/settings/appearance'),
        },
        {
            icon: 'bell.fill',
            title: 'Notifications',
            onPress: () => router.push('/settings/notifications'),
        },
    ];

    const supportRows: RowSpec[] = [
        {
            icon: 'lifepreserver.fill',
            title: 'Contact support',
            onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Adler%20support`),
            trailing: 'external',
        },
        {
            icon: 'doc.text.fill',
            title: 'Terms of Service',
            onPress: () => Linking.openURL(TERMS_URL),
            trailing: 'external',
        },
        {
            icon: 'shield.fill',
            title: 'Privacy Policy',
            onPress: () => Linking.openURL(PRIVACY_URL),
            trailing: 'external',
        },
        {
            icon: 'info.circle.fill',
            title: 'About Adler',
            onPress: () => router.push('/settings/about'),
        },
    ];

    const destructiveRows: RowSpec[] = [
        {
            icon: 'rectangle.portrait.and.arrow.right.fill',
            title: 'Sign out',
            onPress: () => setSignOutSheet(true),
            destructive: true,
            trailing: 'none',
        },
        {
            icon: 'trash.fill',
            title: 'Delete account',
            onPress: () => setDeleteSheet(true),
            destructive: true,
            trailing: 'none',
        },
    ];

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="Settings" onBack={() => router.back()} />

                <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 24 }}>
                    <View style={{ gap: 8 }}>
                        <SectionLabel label="Account" />
                        <SettingsGroup rows={accountRows} />
                    </View>

                    <View style={{ gap: 8 }}>
                        <SectionLabel label="Support" />
                        <SettingsGroup rows={supportRows} />
                    </View>

                    <SettingsGroup rows={destructiveRows} />
                </ScrollView>
            </SafeAreaView>

            <SignOutSheet
                visible={signOutSheet}
                onClose={() => setSignOutSheet(false)}
                onConfirm={onSignOut}
                submitting={signingOut}
            />

            <DeleteAccountSheet
                visible={deleteSheet}
                onClose={() => setDeleteSheet(false)}
                onConfirm={onDeleteAccount}
                submitting={deleting}
            />
        </ThemedView>
    );
}

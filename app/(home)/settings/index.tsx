import React, { useCallback, useState } from 'react';
import { View, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SettingsScreenLayout } from '@/components/base/SettingsScreenLayout';
import { SectionLabel } from '@/components/base/SectionLabel';
import {
    SettingsGroup,
    type SettingsRowSpec,
} from '@/components/ui/SettingsRow';
import { SignOutSheet } from '@/components/features/account/SignOutSheet';
import { DeleteAccountSheet } from '@/components/features/account/DeleteAccountSheet';
import { useAuth } from '@/contexts/AuthContext';
import { deleteAccount } from '@/lib/services/privyAuthService';
import { toast } from '@/lib/utils/toast';

const TERMS_URL = 'https://emptea.xyz/terms-of-service';
const PRIVACY_URL = 'https://emptea.xyz/privacy-policy';
const SUPPORT_EMAIL = 'support@emptea.xyz';

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

    const accountRows: SettingsRowSpec[] = [
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
            icon: 'bell.fill',
            title: 'Notifications',
            onPress: () => router.push('/settings/notifications'),
        },
        {
            icon: 'circle.lefthalf.filled',
            title: 'Appearance',
            onPress: () => router.push('/settings/appearance'),
        },
    ];

    const supportRows: SettingsRowSpec[] = [
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

    const destructiveRows: SettingsRowSpec[] = [
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
        <>
            <SettingsScreenLayout
                title="Settings"
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 24 }}
            >
                <View style={{ gap: 8 }}>
                    <SectionLabel label="Account" />
                    <SettingsGroup rows={accountRows} />
                </View>

                <View style={{ gap: 8 }}>
                    <SectionLabel label="Support" />
                    <SettingsGroup rows={supportRows} />
                </View>

                <SettingsGroup rows={destructiveRows} />
            </SettingsScreenLayout>

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
        </>
    );
}

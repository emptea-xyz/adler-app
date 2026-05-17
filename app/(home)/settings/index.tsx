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
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';

const TERMS_URL = 'https://emptea.xyz/terms-of-service';
const PRIVACY_URL = 'https://emptea.xyz/privacy-policy';
const SUPPORT_EMAIL = 'support@emptea.xyz';

export default function SettingsIndexScreen() {
    const { signOut } = useAuth();
    const router = useRouter();
    const [signOutSheet, setSignOutSheet] = useState(false);
    const [signingOut, setSigningOut] = useState(false);

    const onSignOut = useCallback(async () => {
        haptic('medium');
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
    // Account deletion is intentionally NOT mirrored here — it lives in
    // /settings/account with the username-confirm guard so it can't be
    // tripped from a tap-deep stack.

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
    ];

    return (
        <>
            <SettingsScreenLayout
                title="Settings"
                contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 16, paddingBottom: 48, gap: 24 }}
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
        </>
    );
}

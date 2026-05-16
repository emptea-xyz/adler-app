import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SettingsScreenLayout } from '@/components/base/SettingsScreenLayout';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { SignOutSheet } from '@/components/features/account/SignOutSheet';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { deleteAccount } from '@/lib/services/privyAuthService';
import { toast } from '@/lib/utils/toast';

function ReadoutRow({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <View style={{ gap: 4 }}>
            <SectionLabel label={label} />
            <ThemedText type="body-sm">{value}</ThemedText>
        </View>
    );
}

export default function SettingsAccountScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { user, walletAddress, signOut } = useAuth();
    const { profile } = useUser();
    const [signOutSheet, setSignOutSheet] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const expectedDeleteText = useMemo(
        () => (profile?.username ? `@${profile.username}` : ''),
        [profile?.username],
    );
    const canDelete = expectedDeleteText.length > 0 && confirmText.trim() === expectedDeleteText;

    const onSignOut = async () => {
        setSigningOut(true);
        try {
            await signOut();
            setSignOutSheet(false);
            router.replace('/(auth)/sign-in');
        } catch {
            toast.error('Sign-out failed');
            setSigningOut(false);
        }
    };

    const onDelete = async () => {
        if (!canDelete) return;
        setDeleting(true);
        try {
            await deleteAccount();
            await signOut().catch(() => null);
            toast.success('Account deleted');
            router.replace('/(auth)/sign-in');
        } catch (err: any) {
            toast.error(err?.message ?? 'Account deletion failed');
            setDeleting(false);
        }
    };

    return (
        <>
            <SettingsScreenLayout
                title="Account"
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 40,
                    gap: 20,
                }}
            >
                <View style={{ borderRadius: 12, backgroundColor: theme[100], padding: 16, gap: 14 }}>
                    <ReadoutRow label="Handle" value={profile?.username ? `@${profile.username}` : '—'} />
                    <ReadoutRow label="Email" value={user?.email ?? '—'} />
                    <ReadoutRow label="Wallet" value={walletAddress ?? '—'} />
                </View>

                <View style={{ gap: 10 }}>
                    <SectionLabel label="Session" />
                    <Button
                        title="Sign out"
                        variant="destructive"
                        size="lg"
                        onPress={() => setSignOutSheet(true)}
                    />
                </View>

                <View style={{ gap: 10 }}>
                    <SectionLabel label="Delete account" />
                    <ThemedText type="body-sm" style={{ color: theme[500] }}>
                        Type {expectedDeleteText || '@username'} to confirm permanent account deletion.
                    </ThemedText>
                    <TextInput
                        value={confirmText}
                        onChangeText={setConfirmText}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder={expectedDeleteText || '@username'}
                    />
                    <Button
                        title="Delete account"
                        variant="destructive"
                        size="lg"
                        onPress={onDelete}
                        loading={deleting}
                        disabled={deleting || !canDelete}
                    />
                </View>
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

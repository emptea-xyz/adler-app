import React, { useCallback, useState } from 'react';
import { View, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ChevronRight,
    ExternalLink,
    LogOut,
    UserCog,
    Sun,
    Bell,
    FileText,
    Shield,
    LifeBuoy,
    Info,
    Trash2,
} from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import Card from '@/components/ui/Card';
import { SignOutSheet } from '@/components/features/account/SignOutSheet';
import { DeleteAccountSheet } from '@/components/features/account/DeleteAccountSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { deleteAccount } from '@/lib/services/privyAuthService';
import { toast } from '@/lib/utils/toast';

const TERMS_URL = 'https://emptea.xyz/terms-of-service';
const PRIVACY_URL = 'https://emptea.xyz/privacy-policy';
const SUPPORT_EMAIL = 'support@emptea.xyz';

type TrailingIcon = 'chevron' | 'external' | 'none';

function Row({
    icon,
    title,
    onPress,
    destructive,
    trailing = 'chevron',
}: {
    icon: React.ReactNode;
    title: string;
    onPress: () => void;
    destructive?: boolean;
    trailing?: TrailingIcon;
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
            {trailing === 'chevron' ? <ChevronRight color={theme[400]} size={18} /> : null}
            {trailing === 'external' ? <ExternalLink color={theme[400]} size={16} /> : null}
        </Card>
    );
}

export default function SettingsIndexScreen() {
    const { signOut } = useAuth();
    const { theme } = useTheme();
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
            // Auth user is gone — sign out client-side state and land on sign-in.
            await signOut().catch(() => null);
            toast.success('Account deleted');
            setDeleteSheet(false);
            router.replace('/(auth)/sign-in');
        } catch (err: any) {
            toast.error(err?.message ?? 'Account deletion failed');
            setDeleting(false);
        }
    }, [signOut, router]);

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title="Settings" onBack={() => router.back()} />

                <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}>
                    <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                        <SectionLabel label="Account" />
                    </View>
                    <Row
                        icon={<UserCog color={theme[700]} size={18} />}
                        title="Profile"
                        onPress={() => router.push('/settings/profile')}
                    />
                    <Row
                        icon={<LogOut color={theme[700]} size={18} />}
                        title="Account"
                        onPress={() => router.push('/settings/account')}
                    />

                    <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
                        <SectionLabel label="Preferences" />
                    </View>
                    <Row
                        icon={<Sun color={theme[700]} size={18} />}
                        title="Appearance"
                        onPress={() => router.push('/settings/appearance')}
                    />
                    <Row
                        icon={<Bell color={theme[700]} size={18} />}
                        title="Notifications"
                        onPress={() => router.push('/settings/notifications')}
                    />

                    <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
                        <SectionLabel label="Help" />
                    </View>
                    <Row
                        icon={<LifeBuoy color={theme[700]} size={18} />}
                        title="Contact support"
                        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Adler%20support`)}
                        trailing="external"
                    />

                    <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
                        <SectionLabel label="Legal" />
                    </View>
                    <Row
                        icon={<FileText color={theme[700]} size={18} />}
                        title="Terms of Service"
                        onPress={() => Linking.openURL(TERMS_URL)}
                        trailing="external"
                    />
                    <Row
                        icon={<Shield color={theme[700]} size={18} />}
                        title="Privacy Policy"
                        onPress={() => Linking.openURL(PRIVACY_URL)}
                        trailing="external"
                    />

                    <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
                        <SectionLabel label="About" />
                    </View>
                    <Row
                        icon={<Info color={theme[700]} size={18} />}
                        title="About Adler"
                        onPress={() => router.push('/settings/about')}
                    />

                    <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
                        <SectionLabel label="Session" />
                    </View>
                    <Row
                        icon={<LogOut color="#DC143C" size={18} />}
                        title="Sign out"
                        onPress={() => setSignOutSheet(true)}
                        destructive
                        trailing="none"
                    />
                    <Row
                        icon={<Trash2 color="#DC143C" size={18} />}
                        title="Delete account"
                        onPress={() => setDeleteSheet(true)}
                        destructive
                        trailing="none"
                    />
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

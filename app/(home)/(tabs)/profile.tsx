import React from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, MapPin, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { Avatar } from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import { WalletPill } from '@/components/ui/WalletPill';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { haptic } from '@/lib/utils/haptic';

export default function ProfileScreen() {
    const { theme } = useTheme();
    const { profile } = useUser();
    const { walletAddress } = useAuth();
    const { openWallet } = useOverlaySheets();
    const insets = useSafeAreaInsets();

    if (!profile) return <ThemedView style={{ flex: 1 }} />;

    const locationLabel =
        profile.location.kind === 'city' && profile.location.city
            ? `${profile.location.city}, ${profile.location.country ?? ''}`.trim().replace(/,\s*$/, '')
            : 'Global';

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 16,
                    paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
                    paddingHorizontal: 16,
                    gap: 16,
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <ThemedText type="h2" style={{ color: theme[950] }}>
                        Profile
                    </ThemedText>
                    <Pressable
                        onPress={() => {
                            haptic('light');
                            router.push('/settings');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Settings"
                        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme[100], alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Settings size={16} color={theme[950]} />
                    </Pressable>
                </View>

                <Card variant="filled">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Avatar size="lg" avatarUrl={profile.avatarUrl} initial={profile.displayName.charAt(0)} />
                        <View style={{ flex: 1, gap: 2 }}>
                            <ThemedText type="h4" style={{ color: theme[950] }}>{profile.displayName}</ThemedText>
                            <ThemedText type="body-sm" style={{ color: theme[500] }}>@{profile.username}</ThemedText>
                        </View>
                    </View>
                    {profile.bio ? (
                        <ThemedText type="body-md" style={{ color: theme[800], marginTop: 12 }}>
                            {profile.bio}
                        </ThemedText>
                    ) : null}
                </Card>

                <Pressable
                    onPress={() => {
                        haptic('light');
                        router.push('/settings/profile');
                    }}
                >
                    <Card variant="outline">
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <MapPin size={18} color={theme[700]} />
                            <View style={{ flex: 1 }}>
                                <ThemedText type="caption-semibold" style={{ color: theme[500] }}>LOCATION</ThemedText>
                                <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>{locationLabel}</ThemedText>
                            </View>
                            <ChevronRight size={16} color={theme[400]} />
                        </View>
                    </Card>
                </Pressable>

                <View>
                    <ThemedText type="caption-semibold" style={{ color: theme[500], marginBottom: 8, marginLeft: 4 }}>WALLET</ThemedText>
                    <Pressable onPress={openWallet}>
                        <WalletPill amount={walletAddress ? '—' : '—'} loading={false} onPress={openWallet} />
                    </Pressable>
                </View>
            </ScrollView>
        </ThemedView>
    );
}

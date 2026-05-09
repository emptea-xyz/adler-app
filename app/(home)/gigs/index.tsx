import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MoreHorizontal, Plus } from 'lucide-react-native';
import { ProfileGate } from '@/components/base/ProfileGate';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { ManageListingSheet } from '@/components/features/listing/ManageListingSheet';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Pill, type PillIntent } from '@/components/ui/Pill';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { qk } from '@/lib/constants/queryKeys';
import { listMyListings } from '@/lib/services/listingsService';
import { formatSol } from '@/lib/utils/formatNumber';
import type { Gig } from '@/types/marketplace';

function gigIntent(status: Gig['status']): PillIntent {
    if (status === 'open') return 'cyan';
    if (status === 'awarded') return 'lime';
    return 'neutral';
}

export default function GigsIndexScreen() {
    const { theme } = useTheme();
    const { profile } = useUser();
    const router = useRouter();
    const [manageGig, setManageGig] = useState<Gig | null>(null);

    const gigsQuery = useQuery({
        queryKey: profile?.id ? qk.listings.byOwner('gig', profile.id) : ['listings', 'byOwner', 'gig', 'anon'],
        enabled: !!profile?.id,
        queryFn: async () => {
            const rows = await listMyListings('gig', profile!.id);
            return rows.filter((row): row is Gig => row.kind === 'gig');
        },
    });

    const gigs = useMemo(() => gigsQuery.data ?? [], [gigsQuery.data]);

    return (
        <ProfileGate require="brand">
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="My gigs" onBack={() => router.back()} />
                    {gigsQuery.isLoading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator color={theme[950]} />
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingTop: 16,
                                paddingBottom: 32,
                                gap: 14,
                            }}
                            showsVerticalScrollIndicator={false}
                        >
                            <Button
                                title="Post gig"
                                onPress={() => router.push('/gigs/new')}
                                leftIcon={<Plus size={16} color={theme[50]} />}
                            />

                            {gigs.length === 0 ? (
                                <EmptyState
                                    title="No gigs yet"
                                    description="Post your first brief to start receiving applications."
                                />
                            ) : (
                                gigs.map((gig) => (
                                    <Pressable
                                        key={gig.id}
                                        onPress={() => router.push(`/gig/${gig.id}`)}
                                        style={{
                                            borderRadius: 12,
                                            backgroundColor: theme[100],
                                            padding: 16,
                                            gap: 10,
                                        }}
                                    >
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <SectionLabel label={gig.category} />
                                            <Pill intent={gigIntent(gig.status)} label={gig.status} />
                                        </View>
                                        <ThemedText type="body-lg-semibold" numberOfLines={2}>
                                            {gig.title}
                                        </ThemedText>
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                            }}
                                        >
                                            <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                                Budget {formatSol(gig.budgetSol)} SOL
                                            </ThemedText>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                <Button
                                                    title="Edit"
                                                    variant="secondary"
                                                    size="sm"
                                                    onPress={() => router.push(`/gigs/${gig.id}/edit`)}
                                                />
                                                <Button
                                                    title=""
                                                    variant="secondary"
                                                    size="sm"
                                                    onPress={() => setManageGig(gig)}
                                                    leftIcon={<MoreHorizontal size={14} color={theme[950]} />}
                                                    accessibilityLabel="Manage gig status"
                                                />
                                            </View>
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </ScrollView>
                    )}
                </SafeAreaView>
                {manageGig ? (
                    <ManageListingSheet
                        visible={!!manageGig}
                        onClose={() => setManageGig(null)}
                        kind="gig"
                        id={manageGig.id}
                        status={manageGig.status}
                        ownerId={manageGig.brandId}
                    />
                ) : null}
            </ThemedView>
        </ProfileGate>
    );
}


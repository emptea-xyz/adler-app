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
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { qk } from '@/lib/constants/queryKeys';
import { listMyListings } from '@/lib/services/listingsService';
import { formatSol } from '@/lib/utils/formatNumber';
import type { Service } from '@/types/marketplace';

function serviceIntent(status: Service['status']): PillIntent {
    if (status === 'active') return 'cyan';
    if (status === 'sold') return 'lime';
    return 'neutral';
}

export default function ServicesIndexScreen() {
    const { theme } = useTheme();
    const { profile } = useUser();
    const router = useRouter();
    const { openCreate } = useOverlaySheets();
    const [manageService, setManageService] = useState<Service | null>(null);

    const servicesQuery = useQuery({
        queryKey: profile?.id ? qk.listings.byOwner('service', profile.id) : ['listings', 'byOwner', 'service', 'anon'],
        enabled: !!profile?.id,
        queryFn: async () => {
            const rows = await listMyListings('service', profile!.id);
            return rows.filter((row): row is Service => row.kind === 'service');
        },
    });

    const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);

    return (
        <ProfileGate require="creator">
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="My services" onBack={() => router.back()} />
                    {servicesQuery.isLoading ? (
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
                                title="List service"
                                onPress={openCreate}
                                leftIcon={<Plus size={16} color={theme[50]} />}
                            />

                            {services.length === 0 ? (
                                <EmptyState
                                    title="No services yet"
                                    description="List your first service to appear in brand browse."
                                />
                            ) : (
                                services.map((service) => (
                                    <Pressable
                                        key={service.id}
                                        onPress={() => router.push(`/service/${service.id}`)}
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
                                            <SectionLabel label={service.category} />
                                            <Pill intent={serviceIntent(service.status)} label={service.status} />
                                        </View>
                                        <ThemedText type="body-lg-semibold" numberOfLines={2}>
                                            {service.title}
                                        </ThemedText>
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                            }}
                                        >
                                            <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                                Price {formatSol(service.priceSol)} SOL
                                            </ThemedText>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                <Button
                                                    title="Edit"
                                                    variant="secondary"
                                                    size="sm"
                                                    onPress={() => router.push(`/services/${service.id}/edit`)}
                                                />
                                                <Button
                                                    title=""
                                                    variant="secondary"
                                                    size="sm"
                                                    onPress={() => setManageService(service)}
                                                    leftIcon={<MoreHorizontal size={14} color={theme[950]} />}
                                                    accessibilityLabel="Manage service status"
                                                />
                                            </View>
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </ScrollView>
                    )}
                </SafeAreaView>
                {manageService ? (
                    <ManageListingSheet
                        visible={!!manageService}
                        onClose={() => setManageService(null)}
                        kind="service"
                        id={manageService.id}
                        status={manageService.status}
                        ownerId={manageService.sellerId}
                    />
                ) : null}
            </ThemedView>
        </ProfileGate>
    );
}


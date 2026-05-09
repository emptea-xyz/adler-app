import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ProfileGate } from '@/components/base/ProfileGate';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import EmptyState from '@/components/ui/EmptyState';
import { Pill, type PillIntent } from '@/components/ui/Pill';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { qk } from '@/lib/constants/queryKeys';
import { listApplicationsByCreator } from '@/lib/services/applicationsService';
import { formatRelative } from '@/lib/utils/dates';
import type { ApplicationStatus, GigApplication } from '@/lib/types/application';

const STATUS_FILTERS = ['all', 'pending', 'shortlisted', 'awarded', 'rejected'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusIntent(status: ApplicationStatus): PillIntent {
    if (status === 'awarded') return 'lime';
    if (status === 'shortlisted') return 'cyan';
    if (status === 'rejected') return 'neutral';
    return 'pink';
}

export default function ApplicationsScreen() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const router = useRouter();
    const [filter, setFilter] = useState<StatusFilter>('all');

    const applicationsQuery = useQuery({
        queryKey: user ? qk.applications.byCreator(user.id) : ['applications', 'byCreator', 'anon'],
        enabled: !!user,
        queryFn: () => listApplicationsByCreator(user!.id),
    });

    const applications = useMemo(() => applicationsQuery.data ?? [], [applicationsQuery.data]);
    const filtered = useMemo(
        () => (filter === 'all' ? applications : applications.filter((row) => row.status === filter)),
        [applications, filter],
    );

    return (
        <ProfileGate require="creator">
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="My applications" onBack={() => router.back()} />
                    {applicationsQuery.isLoading ? (
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
                            <SegmentedToggle tabs={STATUS_FILTERS} activeTab={filter} onTabChange={setFilter} size="sm" />
                            {filtered.length === 0 ? (
                                <EmptyState
                                    title={applications.length === 0 ? 'No applications yet' : 'No matches for this status'}
                                    description={
                                        applications.length === 0
                                            ? 'Pitch open gigs from Browse to start your pipeline.'
                                            : 'Switch filter to inspect other application states.'
                                    }
                                />
                            ) : (
                                filtered.map((application: GigApplication) => (
                                    <Pressable
                                        key={application.id}
                                        onPress={() => router.push(`/gig/${application.gigId}`)}
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
                                            <SectionLabel label={application.gigTitle ?? 'Gig application'} />
                                            <Pill intent={statusIntent(application.status)} label={application.status} />
                                        </View>
                                        <ThemedText type="body-sm" style={{ color: theme[950] }} numberOfLines={3}>
                                            {application.message}
                                        </ThemedText>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <ThemedText type="caption" style={{ color: theme[500] }}>
                                                {application.sampleUrls.length} sample links
                                            </ThemedText>
                                            <ThemedText type="caption" style={{ color: theme[500] }}>
                                                {formatRelative(application.createdAt)}
                                            </ThemedText>
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </ScrollView>
                    )}
                </SafeAreaView>
            </ThemedView>
        </ProfileGate>
    );
}

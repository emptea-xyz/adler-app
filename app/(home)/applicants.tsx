import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfileGate } from '@/components/base/ProfileGate';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Pill, type PillIntent } from '@/components/ui/Pill';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { APPLICATION_KEYS, qk } from '@/lib/constants/queryKeys';
import {
    awardApplicationAndCloseGig,
    listApplicationsForGig,
    setApplicationStatus,
} from '@/lib/services/applicationsService';
import { getListing } from '@/lib/services/listingsService';
import { formatRelative } from '@/lib/utils/dates';
import { toast } from '@/lib/utils/toast';
import type { ApplicationStatus, GigApplication } from '@/lib/types/application';
import type { Gig } from '@/lib/types/listing';

const STATUS_FILTERS = ['all', 'pending', 'shortlisted', 'awarded', 'rejected'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusIntent(status: ApplicationStatus): PillIntent {
    if (status === 'awarded') return 'lime';
    if (status === 'shortlisted') return 'cyan';
    if (status === 'rejected') return 'neutral';
    return 'pink';
}

export default function ApplicantsScreen() {
    const { gigId } = useLocalSearchParams<{ gigId?: string }>();
    const { user } = useAuth();
    const { theme } = useTheme();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [pendingAction, setPendingAction] = useState<string | null>(null);

    const gigQuery = useQuery({
        queryKey: gigId ? qk.listings.detail('gig', gigId) : ['listings', 'detail', 'gig', 'missing'],
        enabled: !!gigId,
        queryFn: async () => {
            const row = await getListing('gig', gigId!);
            return row && row.kind === 'gig' ? (row as Gig) : null;
        },
    });

    const applicantsQuery = useQuery({
        queryKey: gigId ? APPLICATION_KEYS.forGig(gigId) : ['applications', 'gig', 'missing'],
        enabled: !!gigId,
        queryFn: () => listApplicationsForGig(gigId!),
    });

    const applicants = useMemo(() => applicantsQuery.data ?? [], [applicantsQuery.data]);
    const filtered = useMemo(
        () => (filter === 'all' ? applicants : applicants.filter((row) => row.status === filter)),
        [applicants, filter],
    );

    const runDecision = async (application: GigApplication, next: 'shortlisted' | 'rejected' | 'awarded') => {
        if (!gigId || !user?.id) return;
        const key = `${application.id}:${next}`;
        setPendingAction(key);
        try {
            if (next === 'awarded') {
                await awardApplicationAndCloseGig({ gigId, applicationId: application.id });
                toast.success('Gig awarded and remaining applicants rejected');
            } else {
                await setApplicationStatus(application.id, next);
                toast.success(next === 'shortlisted' ? 'Applicant shortlisted' : 'Applicant rejected');
            }
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: APPLICATION_KEYS.forGig(gigId) }),
                queryClient.invalidateQueries({ queryKey: qk.applications.byCreator(application.creatorId) }),
                queryClient.invalidateQueries({ queryKey: qk.applications.byBrand(user.id) }),
                queryClient.invalidateQueries({ queryKey: qk.threads.byParticipant(application.creatorId) }),
                queryClient.invalidateQueries({ queryKey: qk.threads.byParticipant(user.id) }),
                queryClient.invalidateQueries({ queryKey: qk.listings.detail('gig', gigId) }),
                queryClient.invalidateQueries({ queryKey: qk.listings.byOwner('gig', user.id) }),
                queryClient.invalidateQueries({ queryKey: qk.listings.list('gig', null) }),
            ]);
        } catch (err: any) {
            toast.error(err?.message ?? 'Could not update application');
        } finally {
            setPendingAction(null);
        }
    };

    if (!gigId) {
        return (
            <ProfileGate require="brand">
                <ThemedView className="flex-1">
                    <SafeAreaView edges={['top']} className="flex-1">
                        <ScreenHeader title="Applicants" onBack={() => router.back()} />
                        <View className="flex-1 items-center justify-center px-4">
                            <ThemedText type="body-md" style={{ color: theme[500] }}>
                                Missing gig id.
                            </ThemedText>
                        </View>
                    </SafeAreaView>
                </ThemedView>
            </ProfileGate>
        );
    }

    return (
        <ProfileGate require="brand">
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} className="flex-1">
                    <ScreenHeader title="Applicants" onBack={() => router.back()} />
                    {gigQuery.isLoading || applicantsQuery.isLoading ? (
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
                            <View style={{ gap: 4 }}>
                                <SectionLabel label="Gig" />
                                <ThemedText type="body-lg-semibold">{gigQuery.data?.title ?? '—'}</ThemedText>
                            </View>
                            <SegmentedToggle tabs={STATUS_FILTERS} activeTab={filter} onTabChange={setFilter} size="sm" />
                            {filtered.length === 0 ? (
                                <EmptyState
                                    title={applicants.length === 0 ? 'No applications yet' : 'No matches for this status'}
                                    description={
                                        applicants.length === 0
                                            ? 'Applications will appear here when creators pitch this gig.'
                                            : 'Switch filter to inspect other applicant states.'
                                    }
                                />
                            ) : (
                                filtered.map((application) => {
                                    const closed = gigQuery.data?.status !== 'open';
                                    return (
                                        <View
                                            key={application.id}
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
                                                <ThemedText type="body-md-semibold">
                                                    {application.creatorDisplayName ?? 'Creator'}
                                                </ThemedText>
                                                <Pill intent={statusIntent(application.status)} label={application.status} />
                                            </View>
                                            <ThemedText type="caption" style={{ color: theme[500] }}>
                                                @{application.creatorHandle ?? 'unknown'} · {formatRelative(application.createdAt)}
                                            </ThemedText>
                                            <ThemedText type="body-sm" style={{ color: theme[950] }}>
                                                {application.message}
                                            </ThemedText>
                                            {application.sampleUrls.length > 0 ? (
                                                <View style={{ gap: 4 }}>
                                                    {application.sampleUrls.map((url) => (
                                                        <ThemedText key={url} type="caption" style={{ color: theme[500] }} numberOfLines={1}>
                                                            {url}
                                                        </ThemedText>
                                                    ))}
                                                </View>
                                            ) : (
                                                <ThemedText type="caption" style={{ color: theme[500] }}>
                                                    No sample links
                                                </ThemedText>
                                            )}

                                            {closed ? (
                                                <ThemedText type="caption" style={{ color: theme[500] }}>
                                                    This gig is closed for new decisions.
                                                </ThemedText>
                                            ) : application.status === 'awarded' || application.status === 'rejected' ? null : (
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {application.status !== 'shortlisted' ? (
                                                        <Button
                                                            title="Shortlist"
                                                            size="sm"
                                                            variant="secondary"
                                                            onPress={() => runDecision(application, 'shortlisted')}
                                                            loading={pendingAction === `${application.id}:shortlisted`}
                                                            disabled={!!pendingAction}
                                                        />
                                                    ) : null}
                                                    <Button
                                                        title="Reject"
                                                        size="sm"
                                                        variant="secondary"
                                                        onPress={() => runDecision(application, 'rejected')}
                                                        loading={pendingAction === `${application.id}:rejected`}
                                                        disabled={!!pendingAction}
                                                    />
                                                    <Button
                                                        title="Award"
                                                        size="sm"
                                                        variant="primary"
                                                        onPress={() => runDecision(application, 'awarded')}
                                                        loading={pendingAction === `${application.id}:awarded`}
                                                        disabled={!!pendingAction}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>
                    )}
                </SafeAreaView>
            </ThemedView>
        </ProfileGate>
    );
}

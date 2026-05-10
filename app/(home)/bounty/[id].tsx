import React, { useState } from 'react';
import { ScrollView, View, Pressable, Linking, Image, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flag, ExternalLink, Trophy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import { useBounty } from '@/hooks/useBounty';
import { useBountyEscrow } from '@/hooks/useBountyEscrow';
import {
    listSubmissionsForBounty,
    listMySubmissionsForBounty,
} from '@/lib/services/submissionService';
import { getProfile } from '@/lib/services/profileService';
import { reportBounty, hasReported } from '@/lib/services/reportService';
import { qk } from '@/lib/constants/queryKeys';
import { explorerTxUrl } from '@/lib/solana/connection';
import { formatSol, formatLargeNumber } from '@/lib/utils/formatNumber';
import { formatRelative } from '@/lib/utils/dates';
import { haptic } from '@/lib/utils/haptic';
import { toast } from '@/lib/utils/toast';
import { EMPTY_BOUNTY_SUBMISSIONS } from '@/lib/utils/copy';
import { MAX_AUTO_SUBMISSIONS_PER_USER } from '@/lib/constants/escrow';
import type { Submission } from '@/lib/types/submission';

export default function BountyDetailScreen() {
    const { id: idParam } = useLocalSearchParams<{ id: string }>();
    const id = String(idParam ?? '');
    const { theme } = useTheme();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const [reportOpen, setReportOpen] = useState(false);
    const [pickWinnerSheet, setPickWinnerSheet] = useState<Submission | null>(null);

    const bountyQuery = useBounty(id);
    const submissionsQuery = useQuery({
        queryKey: qk.submissions.byBounty(id),
        queryFn: () => listSubmissionsForBounty(id),
        staleTime: 15_000,
        enabled: !!id,
    });
    const mySubmissionsQuery = useQuery({
        queryKey: user ? qk.submissions.mineForBounty(id, user.id) : ['submissions', 'mineForBounty', 'anon'],
        queryFn: () => (user && id ? listMySubmissionsForBounty(id, user.id) : Promise.resolve([])),
        staleTime: 15_000,
        enabled: !!user && !!id,
    });

    const bounty = bountyQuery.data;
    const submissions = submissionsQuery.data ?? [];
    const mineCount = (mySubmissionsQuery.data ?? []).length;
    const isPoster = user && bounty && bounty.posterId === user.id;
    const canSubmit =
        !!user && !!bounty && !isPoster && bounty.status === 'open' &&
        (bounty.mode !== 'auto' || mineCount < MAX_AUTO_SUBMISSIONS_PER_USER);

    const onRefresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: qk.bounties.detail(id) }),
            queryClient.invalidateQueries({ queryKey: qk.submissions.byBounty(id) }),
        ]);
    };

    const onReport = async () => {
        if (!bounty || !user) return;
        if (await hasReported(bounty.id, user.id)) {
            toast.info('You already reported this bounty.');
            setReportOpen(false);
            return;
        }
        try {
            await reportBounty(bounty.id, 'user-reported');
            haptic('medium');
            toast.success('Report submitted.');
            setReportOpen(false);
        } catch (err) {
            haptic('error');
            toast.error(err instanceof Error ? err.message : 'Could not submit report');
        }
    };

    if (bountyQuery.isLoading || !bounty) {
        return (
            <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
                <ScreenHeader title="Bounty" />
                <View style={{ padding: 16, gap: 12 }}>
                    <Skeleton height={48} />
                    <Skeleton height={120} />
                    <Skeleton height={64} />
                </View>
            </ThemedView>
        );
    }

    const headerActions = !isPoster
        ? {
              icon: Flag,
              onPress: () => setReportOpen(true),
              accessibilityLabel: 'Report bounty',
          }
        : undefined;

    return (
        <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
            <ScreenHeader title="Bounty" actionButton={headerActions} />
            <ScrollView
                contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 200 + insets.bottom }}
                refreshControl={
                    <RefreshControl
                        refreshing={bountyQuery.isFetching || submissionsQuery.isFetching}
                        onRefresh={onRefresh}
                    />
                }
            >
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <ThemedText type="h1" style={{ color: theme[950] }}>
                            {formatSol(bounty.bountyLamports / 1e9)} SOL
                        </ThemedText>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <Pill intent={bounty.mode === 'auto' ? 'cyan' : 'pink'} label={bounty.mode === 'auto' ? 'AUTO' : 'MANUAL'} />
                            <Pill
                                intent={
                                    bounty.status === 'open'
                                        ? 'lime'
                                        : bounty.status === 'settled'
                                          ? 'cyan'
                                          : bounty.status === 'refunded'
                                            ? 'neutral'
                                            : 'dark'
                                }
                                label={bounty.status.toUpperCase()}
                            />
                        </View>
                    </View>
                    <ThemedText type="body-md" style={{ color: theme[500], marginTop: 4 }}>
                        Expires {formatRelative(bounty.expiresAt)} · {formatLargeNumber(bounty.reportCount)} reports
                    </ThemedText>
                </View>

                <Card variant="filled">
                    <ThemedText type="h4" style={{ color: theme[950], marginBottom: 8 }}>
                        {bounty.title}
                    </ThemedText>
                    <ThemedText type="body-md" style={{ color: theme[800] }}>
                        {bounty.prompt}
                    </ThemedText>
                </Card>

                {bounty.txSignature ? (
                    <Pressable
                        onPress={() => Linking.openURL(explorerTxUrl(bounty.txSignature!))}
                    >
                        <Card variant="border-bottom">
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <Trophy size={18} color={theme[700]} />
                                    <View>
                                        <SectionLabel label={bounty.status === 'refunded' ? 'REFUNDED' : 'SETTLED'} />
                                        <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                                            View on Solscan
                                        </ThemedText>
                                    </View>
                                </View>
                                <ExternalLink size={16} color={theme[400]} />
                            </View>
                        </Card>
                    </Pressable>
                ) : null}

                <View>
                    <SectionLabel label={`SUBMISSIONS · ${submissions.length}`} />
                    {submissions.length === 0 ? (
                        <EmptyState
                            title={EMPTY_BOUNTY_SUBMISSIONS.title}
                            description={EMPTY_BOUNTY_SUBMISSIONS.description}
                        />
                    ) : (
                        submissions.map((sub) => (
                            <SubmissionCard
                                key={sub.id}
                                submission={sub}
                                isPoster={!!isPoster}
                                isOpen={bounty.status === 'open'}
                                isManual={bounty.mode === 'manual'}
                                onPickWinner={() => setPickWinnerSheet(sub)}
                            />
                        ))
                    )}
                </View>
            </ScrollView>

            {canSubmit ? (
                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: 16,
                        paddingBottom: 16 + insets.bottom,
                        backgroundColor: theme[50],
                    }}
                >
                    <Button
                        size="lg"
                        variant="primary"
                        title={
                            bounty.mode === 'auto'
                                ? `Submit photo (${mineCount}/${MAX_AUTO_SUBMISSIONS_PER_USER})`
                                : 'Submit photo'
                        }
                        onPress={() => router.push(`/bounty/${id}/submit`)}
                    />
                </View>
            ) : null}

            <Alert
                visible={reportOpen}
                title="Report this bounty?"
                message="Reports go to Adler. After 100 reports, the bounty is hidden."
                confirmText="Report"
                cancelText="Cancel"
                isDestructive
                onConfirm={onReport}
                onCancel={() => setReportOpen(false)}
            />

            {pickWinnerSheet ? (
                <PickWinnerSheet
                    submission={pickWinnerSheet}
                    bounty={bounty}
                    onClose={() => setPickWinnerSheet(null)}
                />
            ) : null}
        </ThemedView>
    );
}

function SubmissionCard({
    submission,
    isPoster,
    isOpen,
    isManual,
    onPickWinner,
}: {
    submission: Submission;
    isPoster: boolean;
    isOpen: boolean;
    isManual: boolean;
    onPickWinner: () => void;
}) {
    const { theme } = useTheme();
    let intent: 'cyan' | 'lime' | 'orange' | 'neutral' = 'neutral';
    let label = 'PENDING';
    if (submission.isWinner) {
        intent = 'cyan';
        label = 'WINNER';
    } else if (submission.aiVerdict === 'pass') {
        intent = 'lime';
        label = 'PASS';
    } else if (submission.aiVerdict === 'fail') {
        intent = 'orange';
        label = 'FAIL';
    }
    return (
        <Card variant="border-bottom">
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <Image
                    source={{ uri: submission.photoUrl }}
                    style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: theme[100] }}
                />
                <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <ThemedText type="body-sm" style={{ color: theme[500] }}>
                            {formatRelative(submission.submittedAt)}
                        </ThemedText>
                        <Pill intent={intent} label={label} />
                    </View>
                    {submission.aiReasoning ? (
                        <ThemedText type="caption" style={{ color: theme[700] }} numberOfLines={3}>
                            {submission.aiReasoning}
                        </ThemedText>
                    ) : null}
                    {isPoster && isManual && isOpen ? (
                        <View style={{ marginTop: 4 }}>
                            <Button
                                size="sm"
                                variant="primary"
                                title="Pick winner"
                                onPress={onPickWinner}
                            />
                        </View>
                    ) : null}
                </View>
            </View>
        </Card>
    );
}

function PickWinnerSheet({
    submission,
    bounty,
    onClose,
}: {
    submission: Submission;
    bounty: import('@/lib/types/bounty').Bounty;
    onClose: () => void;
}) {
    const { settleManual, pending } = useBountyEscrow();
    const queryClient = useQueryClient();
    const onConfirm = async () => {
        try {
            const winnerProfile = await getProfile(submission.submitterId);
            const winnerWalletAddress = winnerProfile?.walletAddress;
            if (!winnerWalletAddress) {
                toast.error('Winner has no wallet on file.');
                onClose();
                return;
            }
            haptic('medium');
            await settleManual({
                bountyId: bounty.id,
                bountyIdHex: bounty.contractIdHex,
                posterWalletAddress: bounty.posterWalletAddress,
                winnerId: submission.submitterId,
                winningSubmissionId: submission.id,
                winnerWalletAddress,
            });
            haptic('heavy');
            await queryClient.invalidateQueries({ queryKey: qk.bounties.detail(bounty.id) });
            toast.success('Winner paid.');
            onClose();
        } catch (err) {
            haptic('error');
            toast.error(err instanceof Error ? err.message : 'Settle failed');
        }
    };
    return (
        <Alert
            visible={true}
            title="Award this submission?"
            message={`${formatSol(bounty.bountyLamports / 1e9)} SOL will be sent on-chain. This cannot be undone.`}
            confirmText={pending ? 'Awarding…' : 'Award'}
            cancelText="Cancel"
            onConfirm={onConfirm}
            onCancel={onClose}
        />
    );
}

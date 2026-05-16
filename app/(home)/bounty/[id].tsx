import React, { useState } from 'react';
import { ScrollView, View, Pressable, Linking, Image, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import Card from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import { BountyTags } from '@/components/features/bounty/BountyTags';
import {
    BountyStatusPill,
    type BountyItemStatus,
} from '@/components/features/bounty/BountyStatusIcon';
import {
    bountyStatusToCard,
    submissionStatusToCard,
} from '@/components/features/bounty/BountyItemCard';
import { Avatar } from '@/components/ui/Avatar';
import { SolanaIcon } from '@/components/ui/SolanaIcon';
import { WonCard } from '@/components/features/bounty/WonCard';
import { Radius } from '@/constants/LayoutConstants';
import { useBounty } from '@/hooks/useBounty';
import { useBountyEscrow } from '@/hooks/useBountyEscrow';
import {
    listSubmissionsForBounty,
    listMySubmissionsForBounty,
} from '@/lib/services/submissionService';
import { getProfile } from '@/lib/services/profileService';
import { reportBounty, hasReported } from '@/lib/services/reportService';
import { qk } from '@/lib/constants/queryKeys';
import { formatSol } from '@/lib/utils/formatNumber';
import { formatRelative, formatRemaining } from '@/lib/utils/dates';
import { haptic } from '@/lib/utils/haptic';
import { toast, toastError } from '@/lib/utils/toast';
import { MAX_SUBMISSIONS_PER_USER } from '@/lib/constants/escrow';
import type { Submission } from '@/lib/types/submission';

export default function BountyDetailScreen() {
    const { id: idParam } = useLocalSearchParams<{ id: string }>();
    const id = String(idParam ?? '');
    const { theme, tw } = useTheme();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const [reportOpen, setReportOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [pickWinnerSheet, setPickWinnerSheet] = useState<Submission | null>(null);
    const { cancel, pending: cancelPending } = useBountyEscrow();

    const bountyQuery = useBounty(id);
    const bounty = bountyQuery.data;
    const isPoster = !!user && !!bounty && bounty.posterId === user.id;
    const cancellable =
        !!bounty &&
        (bounty.status === 'open' || bounty.status === 'in_review') &&
        bounty.submissionCount === 0;

    const posterQuery = useQuery({
        queryKey: bounty?.posterId
            ? qk.profiles.detail(bounty.posterId)
            : ['profiles', 'detail', 'none'],
        queryFn: () => (bounty?.posterId ? getProfile(bounty.posterId) : Promise.resolve(null)),
        enabled: !!bounty?.posterId,
        staleTime: 5 * 60_000,
    });
    const poster = posterQuery.data ?? null;

    const winnerQuery = useQuery({
        queryKey: bounty?.winnerId
            ? qk.profiles.detail(bounty.winnerId)
            : ['profiles', 'detail', 'no-winner'],
        queryFn: () => (bounty?.winnerId ? getProfile(bounty.winnerId) : Promise.resolve(null)),
        enabled: !!bounty?.winnerId,
        staleTime: 5 * 60_000,
    });
    const winner = winnerQuery.data ?? null;

    // Poster sees the full submission list to pick a winner; everyone else
    // sees only a count. The list is therefore only fetched for the poster.
    const submissionsQuery = useQuery({
        queryKey: qk.submissions.byBounty(id),
        queryFn: () => listSubmissionsForBounty(id),
        staleTime: 15_000,
        enabled: !!id && isPoster,
    });
    const submissionCountQuery = useQuery({
        queryKey: [...qk.submissions.byBounty(id), 'count'],
        queryFn: async () => (await listSubmissionsForBounty(id)).length,
        staleTime: 15_000,
        enabled: !!id && !isPoster,
    });
    const mySubmissionsQuery = useQuery({
        queryKey: user ? qk.submissions.mineForBounty(id, user.id) : ['submissions', 'mineForBounty', 'anon'],
        queryFn: () => (user && id ? listMySubmissionsForBounty(id, user.id) : Promise.resolve([])),
        staleTime: 15_000,
        enabled: !!user && !!id,
    });

    const submissions = submissionsQuery.data ?? [];
    const submissionCount = isPoster ? submissions.length : (submissionCountQuery.data ?? 0);
    const mineCount = (mySubmissionsQuery.data ?? []).length;
    const mine = mySubmissionsQuery.data ?? [];

    const submissionWindowOpen = !!bounty && Date.now() < bounty.submissionEndsAt;
    const canSubmit =
        !!user && !!bounty && !isPoster && bounty.status === 'open' &&
        submissionWindowOpen && mineCount < MAX_SUBMISSIONS_PER_USER;

    const onRefresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: qk.bounties.detail(id) }),
            queryClient.invalidateQueries({ queryKey: qk.submissions.byBounty(id) }),
        ]);
    };

    const onCancel = async () => {
        if (!bounty || cancelPending) return;
        try {
            await cancel({
                bountyId: bounty.id,
                bountyIdHex: bounty.contractIdHex,
                posterWalletAddress: bounty.posterWalletAddress,
            });
            haptic('heavy');
            toast.success('Bounty cancelled and refunded.');
            await queryClient.invalidateQueries({ queryKey: qk.bounties.all() });
            setCancelOpen(false);
            router.back();
        } catch (e) {
            toastError(e, "Couldn't cancel bounty");
        }
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
            toastError(err, 'Could not submit report');
        }
    };

    if (bountyQuery.isLoading) {
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
    if (!bounty) {
        return (
            <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
                <ScreenHeader title="Bounty" />
                <View style={{ padding: 24, gap: 12, alignItems: 'center', marginTop: 80 }}>
                    <Icon name="exclamationmark.circle.fill" size={40} color={theme[400]} />
                    <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                        Bounty not found
                    </ThemedText>
                    <ThemedText type="body-sm" style={{ color: theme[500], textAlign: 'center' }}>
                        This bounty has been removed or no longer exists.
                    </ThemedText>
                    <View style={{ marginTop: 8 }}>
                        <Button
                            variant="primary"
                            size="default"
                            title="Go back"
                            onPress={() => router.back()}
                        />
                    </View>
                </View>
            </ThemedView>
        );
    }

    const cardStatus: BountyItemStatus = isPoster
        ? bountyStatusToCard(bounty)
        : mine.length > 0
          ? pickBestSubmissionStatus(mine, bounty)
          : bountyStatusToCard(bounty);

    const headerActions = !isPoster
        ? {
              icon: 'flag.fill' as const,
              onPress: () => setReportOpen(true),
              accessibilityLabel: 'Report bounty',
          }
        : cancellable
          ? {
                icon: 'trash.fill' as const,
                onPress: () => {
                    haptic('medium');
                    setCancelOpen(true);
                },
                accessibilityLabel: 'Cancel bounty',
            }
          : undefined;

    return (
        <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
            <ScreenHeader title="Bounty" actionButton={headerActions} />
            <ScrollView
                contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 200 + insets.bottom }}
                refreshControl={
                    <RefreshControl
                        refreshing={bountyQuery.isFetching || submissionsQuery.isFetching}
                        onRefresh={onRefresh}
                    />
                }
            >
                {/* Hero: title + prompt is the content the user came for. */}
                <View style={{ gap: 12 }}>
                    <ThemedText type="h2" style={{ color: theme[950] }}>
                        {bounty.title}
                    </ThemedText>
                    {poster ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Avatar
                                size="sm"
                                avatarUrl={poster.avatarUrl}
                                initial={poster.displayName.charAt(0)}
                            />
                            <View style={{ flexShrink: 1 }}>
                                <ThemedText
                                    type="body-md-semibold"
                                    style={{ color: theme[950] }}
                                    numberOfLines={1}
                                >
                                    {poster.displayName}
                                </ThemedText>
                                <ThemedText type="caption" style={{ color: theme[500] }}>
                                    @{poster.username}
                                </ThemedText>
                            </View>
                        </View>
                    ) : null}
                    <ThemedText type="body-md" style={{ color: theme[700], lineHeight: 22 }}>
                        {bounty.prompt}
                    </ThemedText>
                </View>

                {/* Meta line: icon-tags + reward + expiry + submissions + status. */}
                <View style={{ gap: 10 }}>
                    <BountyTags bounty={bounty} />
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                        }}
                    >
                        <MetaPill
                            bg={tw.sky[50]}
                            fg={tw.sky[700]}
                            icon={<SolanaIcon size={10} color={tw.sky[700]} />}
                            label={formatSol(bounty.bountyLamports / 1e9)}
                        />
                        <TimePill bounty={bounty} />
                        <MetaPill
                            bg={theme[100]}
                            fg={theme[700]}
                            icon={<Icon name="person.2.fill" size={11} color={theme[700]} />}
                            label={`${submissionCount} ${submissionCount === 1 ? 'submission' : 'submissions'}`}
                        />
                        <BountyStatusPill status={cardStatus} iconSize={12} />
                    </View>
                </View>

                {bounty.status === 'settled' || bounty.status === 'refunded' ? (
                    <WonCard bounty={bounty} winner={winner} />
                ) : null}

                {/* Poster sees the full submission list to pick a winner.
                    For everyone else, the count is already shown inline above. */}
                {isPoster ? (
                    <View>
                        <SectionLabel label="SUBMISSIONS" />
                        {submissions.length === 0 ? (
                            <View style={{ paddingVertical: 12 }}>
                                <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                    No submissions yet. They appear here as soon as people enter.
                                </ThemedText>
                            </View>
                        ) : (
                            submissions.map((sub) => (
                                <SubmissionCard
                                    key={sub.id}
                                    submission={sub}
                                    isOpen={bounty.status === 'open' || bounty.status === 'in_review'}
                                    onPickWinner={() => setPickWinnerSheet(sub)}
                                />
                            ))
                        )}
                    </View>
                ) : null}
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
                            bounty.submissionKind === 'link'
                                ? 'Submit link'
                                : bounty.submissionKind === 'video'
                                  ? 'Submit video'
                                  : 'Submit photo'
                        }
                        onPress={() => router.push(`/bounty/${id}/submit`)}
                    />
                </View>
            ) : !isPoster
                && bounty.status === 'in_review'
                && mineCount === 0 ? (
                // M14: surface the "submissions closed" state explicitly
                // instead of just hiding the submit button silently.
                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: 16,
                        paddingBottom: 16 + insets.bottom,
                        backgroundColor: theme[50],
                        alignItems: 'center',
                    }}
                >
                    <ThemedText type="caption" style={{ color: theme[500], textAlign: 'center' }}>
                        Submissions closed — poster is reviewing.
                    </ThemedText>
                </View>
            ) : null}

            <Alert
                visible={reportOpen}
                title="Report this bounty?"
                message="Tell us if something looks off. Reports go to Adler — your username stays private."
                confirmText="Report"
                cancelText="Cancel"
                isDestructive
                onConfirm={onReport}
                onCancel={() => setReportOpen(false)}
            />

            <Alert
                visible={cancelOpen}
                title="Cancel this bounty?"
                message="This refunds your SOL on-chain and removes the bounty. Not reversible."
                confirmText={cancelPending ? 'Cancelling…' : 'Cancel bounty'}
                cancelText="Keep"
                isDestructive
                onConfirm={onCancel}
                onCancel={() => setCancelOpen(false)}
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

// When the user has multiple submissions on a bounty, surface the most
// favourable state: a win trumps a loss, an active "judging" trumps a stale
// "pending", and so on.
const STATUS_RANK: Record<BountyItemStatus, number> = {
    won: 5,
    processing: 4,
    pending: 3,
    open: 2,
    lost: 1,
    closed: 0,
};
function pickBestSubmissionStatus(
    subs: Submission[],
    bounty: import('@/lib/types/bounty').Bounty,
): BountyItemStatus {
    let best: BountyItemStatus = submissionStatusToCard(subs[0], bounty);
    for (const s of subs.slice(1)) {
        const next = submissionStatusToCard(s, bounty);
        if (STATUS_RANK[next] > STATUS_RANK[best]) best = next;
    }
    return best;
}

function MetaPill({
    bg,
    fg,
    icon,
    label,
}: {
    bg: string;
    fg: string;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: Radius.full,
                backgroundColor: bg,
                alignSelf: 'flex-start',
            }}
        >
            {icon}
            <ThemedText type="caption-semibold" style={{ color: fg }}>
                {label}
            </ThemedText>
        </View>
    );
}

function TimePill({ bounty }: { bounty: import('@/lib/types/bounty').Bounty }) {
    const { theme, tw } = useTheme();
    const isOpen = bounty.status === 'open';
    const isReview = bounty.status === 'in_review';
    // Target may be 0 on legacy docs that pre-date submissionEndsAt /
    // expiresAt. Treat 0 as "unknown" and fall back to the posted-at line
    // so we never render a phantom "expired".
    const target = isOpen
        ? bounty.submissionEndsAt
        : isReview
          ? bounty.expiresAt
          : 0;
    const hasTarget = target > 0;
    const expired = hasTarget && Date.now() >= target;

    let bg: string;
    let fg: string;
    if (expired) {
        bg = tw.red[50];
        fg = tw.red[700];
    } else if (hasTarget && (isOpen || isReview)) {
        bg = tw.amber[50];
        fg = tw.amber[700];
    } else {
        bg = theme[100];
        fg = theme[700];
    }

    const label =
        isOpen && hasTarget
            ? `Closes ${formatRemaining(bounty.submissionEndsAt)}`
            : isReview && hasTarget
              ? `Pick by ${formatRemaining(bounty.expiresAt)}`
              : `Posted ${formatRelative(bounty.createdAt)}`;

    return (
        <MetaPill
            bg={bg}
            fg={fg}
            icon={<Icon name="clock.fill" size={11} color={fg} />}
            label={label}
        />
    );
}

function SubmissionCard({
    submission,
    isOpen,
    onPickWinner,
}: {
    submission: Submission;
    isOpen: boolean;
    onPickWinner: () => void;
}) {
    const { theme } = useTheme();
    const intent: 'info' | 'neutral' = submission.isWinner ? 'info' : 'neutral';
    const label = submission.isWinner ? 'WINNER' : 'PENDING';
    const pillIcon: IconName = submission.isWinner ? 'trophy.fill' : 'clock.fill';
    const isLink = !!submission.linkUrl;
    const isVideo = !!submission.videoUrl;
    return (
        <Card variant="border-bottom">
            <View style={{ flexDirection: 'row', gap: 12 }}>
                {isLink ? (
                    <View
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 8,
                            backgroundColor: theme[100],
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Icon name="link" size={24} color={theme[700]} />
                    </View>
                ) : isVideo ? (
                    <View
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 8,
                            backgroundColor: theme[100],
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Icon name="play.fill" size={24} color={theme[700]} />
                    </View>
                ) : (
                    <Image
                        source={{ uri: submission.photoUrl }}
                        style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: theme[100] }}
                    />
                )}
                <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <ThemedText type="body-sm" style={{ color: theme[500] }}>
                            {formatRelative(submission.submittedAt)}
                        </ThemedText>
                        <Pill intent={intent} label={label} icon={pillIcon} />
                    </View>
                    {isLink && submission.linkUrl ? (
                        <Pressable onPress={() => Linking.openURL(submission.linkUrl!)} hitSlop={4}>
                            <ThemedText
                                type="caption-semibold"
                                style={{ color: theme[700] }}
                                numberOfLines={2}
                            >
                                {submission.linkUrl}
                            </ThemedText>
                        </Pressable>
                    ) : null}
                    {isVideo && submission.videoUrl ? (
                        <Pressable onPress={() => Linking.openURL(submission.videoUrl)} hitSlop={4}>
                            <ThemedText
                                type="caption-semibold"
                                style={{ color: theme[700] }}
                                numberOfLines={1}
                            >
                                Open video
                            </ThemedText>
                        </Pressable>
                    ) : null}
                    {isOpen ? (
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
            toastError(err, 'Settle failed');
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

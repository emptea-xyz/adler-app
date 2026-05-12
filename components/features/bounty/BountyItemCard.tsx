import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { formatSol } from '@/lib/utils/formatNumber';
import { TailwindColors } from '@/constants/TailwindColors';
import {
    BountyStatusPill,
    type BountyItemStatus,
} from '@/components/features/bounty/BountyStatusIcon';
import { GroupLogoDot } from '@/components/features/bounty/BountyTags';
import { SolanaIcon } from '@/components/ui/SolanaIcon';
import { qk } from '@/lib/constants/queryKeys';
import { getGroup } from '@/lib/services/groupService';
import { getProfile } from '@/lib/services/profileService';
import { useBountyEscrow } from '@/hooks/useBountyEscrow';
import { toast } from '@/lib/utils/toast';
import type { Bounty } from '@/lib/types/bounty';
import type { Submission } from '@/lib/types/submission';

/**
 * Universal bounty card per the Figma "bounty-item" component
 * (kQOXiU92EKLEaQ3NeZcWOt @ 227:491). Used in Browse, Inbox, Profile,
 * and anywhere a bounty surfaces as a row. Fixed 100pt height, full
 * parent width, white card with a soft 1pt bottom divider.
 *
 * The status prop is decoupled from the on-chain `Bounty.status` so the
 * same card can render either a poster's view (open / closed / won) or
 * a submitter's view (pending / processing / won / lost). Use the
 * helpers below to derive the right glyph from your domain types.
 */

interface BountyItemCardProps {
    title: string;
    amountLamports: number;
    status: BountyItemStatus;
    /** Poster's uid — used to surface their @username below the title. */
    posterId?: string | null;
    /** When set, a small group logo + name is shown above the title. */
    groupId?: string | null;
    onPress?: () => void;
    onLongPress?: () => void;
}

export function BountyItemCard({
    title,
    amountLamports,
    status,
    posterId,
    groupId,
    onPress,
    onLongPress,
}: BountyItemCardProps) {
    const { theme } = useTheme();

    const groupQuery = useQuery({
        queryKey: groupId ? qk.groups.detail(groupId) : ['groups', 'detail', 'none'],
        queryFn: () => (groupId ? getGroup(groupId) : Promise.resolve(null)),
        enabled: !!groupId,
        staleTime: 5 * 60_000,
    });
    const group = groupQuery.data ?? null;

    const posterQuery = useQuery({
        queryKey: posterId ? qk.profiles.detail(posterId) : ['profiles', 'detail', 'none'],
        queryFn: () => (posterId ? getProfile(posterId) : Promise.resolve(null)),
        enabled: !!posterId,
        staleTime: 5 * 60_000,
    });
    const poster = posterQuery.data ?? null;

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={350}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            accessibilityRole="button"
            accessibilityLabel={title}
        >
            <View
                style={{
                    backgroundColor: theme[50],
                    minHeight: 100,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: theme[100],
                }}
            >
                {group ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <GroupLogoDot
                            name={group.name}
                            logoUrl={group.logoUrl ?? null}
                            size={16}
                        />
                        <ThemedText
                            type="caption-semibold"
                            style={{ color: theme[500] }}
                            numberOfLines={1}
                        >
                            {group.name}
                        </ThemedText>
                    </View>
                ) : null}

                <ThemedText
                    type="body-md-semibold"
                    style={{
                        color: theme[950],
                        fontSize: 14,
                        lineHeight: 18,
                        letterSpacing: -0.36,
                    }}
                    numberOfLines={2}
                >
                    {title}
                </ThemedText>

                {poster?.username ? (
                    <ThemedText
                        type="caption"
                        style={{ color: theme[500] }}
                        numberOfLines={1}
                    >
                        @{poster.username}
                    </ThemedText>
                ) : null}

                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 'auto',
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ThemedText
                            type="body-md-semibold"
                            style={{
                                color: TailwindColors.sky[500],
                                letterSpacing: -0.33,
                            }}
                        >
                            {formatSol(amountLamports / 1e9)}
                        </ThemedText>
                        <SolanaIcon size={12} color={TailwindColors.sky[500]} />
                    </View>
                    <BountyStatusPill status={status} iconSize={12} />
                </View>
            </View>
        </Pressable>
    );
}

/**
 * Map a poster-side bounty to a card status. Use for Browse, Inbox
 * "Posted", and Profile "Created".
 */
export function bountyStatusToCard(b: Bounty): BountyItemStatus {
    switch (b.status) {
        case 'open':
            return 'open';
        case 'in_review':
            return 'processing';
        case 'cancelling':
        case 'hidden':
        case 'refunded':
            return 'closed';
        case 'settled':
            return 'won';
    }
}

/**
 * Map a submitter's submission + the parent bounty to a card status.
 * Use for Inbox "Submitted", Profile "Won", Profile "Participated".
 */
export function submissionStatusToCard(s: Submission, b?: Bounty): BountyItemStatus {
    if (s.isWinner) return 'won';
    // L3: 'lost' is reserved for "poster picked someone else." A refund
    // means nobody won, so it's just 'closed' to the submitter.
    if (b?.status === 'settled') return 'lost';
    if (b?.status === 'refunded' || b?.status === 'hidden' || b?.status === 'cancelling') {
        return 'closed';
    }
    return 'pending';
}

/**
 * Convenience renderer for a bounty in a poster context. Routes to the
 * detail screen on press. Long-press surfaces the cancel-bounty action
 * when the bounty is still cancellable (open or in_review, no submissions
 * yet). The on-chain `cancel_bounty` refunds the poster immediately.
 */
export function BountyCardForBounty({ bounty }: { bounty: Bounty }) {
    const { cancel, pending } = useBountyEscrow();
    const queryClient = useQueryClient();

    const cancellable =
        (bounty.status === 'open' || bounty.status === 'in_review') &&
        bounty.submissionCount === 0;

    const onLongPress = cancellable
        ? () => {
              haptic('medium');
              Alert.alert(
                  'Cancel bounty?',
                  'This refunds your SOL and removes the bounty. Not reversible.',
                  [
                      { text: 'Keep', style: 'cancel' },
                      {
                          text: 'Cancel bounty',
                          style: 'destructive',
                          onPress: async () => {
                              if (pending) return;
                              try {
                                  await cancel({
                                      bountyId: bounty.id,
                                      bountyIdHex: bounty.contractIdHex,
                                      posterWalletAddress: bounty.posterWalletAddress,
                                  });
                                  haptic('heavy');
                                  toast.success('Bounty cancelled and refunded.');
                                  await queryClient.invalidateQueries({ queryKey: qk.bounties.all() });
                              } catch (e) {
                                  haptic('error');
                                  const msg = e instanceof Error ? e.message : String(e);
                                  toast.error(msg || "Couldn't cancel bounty");
                              }
                          },
                      },
                  ],
              );
          }
        : undefined;

    return (
        <BountyItemCard
            title={bounty.title}
            amountLamports={bounty.bountyLamports}
            status={bountyStatusToCard(bounty)}
            posterId={bounty.posterId}
            groupId={bounty.scope === 'group' ? bounty.groupId : null}
            onPress={() => {
                haptic('light');
                router.push(`/bounty/${bounty.id}`);
            }}
            onLongPress={onLongPress}
        />
    );
}

/**
 * Convenience renderer for a submission in a submitter context.
 * Falls back to a generic title if the parent bounty isn't loaded yet.
 */
export function BountyCardForSubmission({
    submission,
    bounty,
}: {
    submission: Submission;
    bounty?: Bounty;
}) {
    return (
        <BountyItemCard
            title={bounty?.title ?? 'Bounty'}
            amountLamports={bounty?.bountyLamports ?? 0}
            status={submissionStatusToCard(submission, bounty)}
            posterId={bounty?.posterId ?? null}
            groupId={bounty?.scope === 'group' ? bounty.groupId : null}
            onPress={() => {
                haptic('light');
                router.push(`/bounty/${submission.bountyId}`);
            }}
        />
    );
}

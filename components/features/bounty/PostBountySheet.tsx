import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Icon } from '@/components/ui/Icon';
import { PopoverMenu } from '@/components/ui/PopoverMenu';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { NumberInput } from '@/components/ui/NumberInput';
import { SolanaIcon } from '@/components/ui/SolanaIcon';
import TextInput from '@/components/ui/TextInput';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ThemedText } from '@/components/base/ThemedText';
import { TailwindColors } from '@/constants/TailwindColors';
import { Radius } from '@/constants/LayoutConstants';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBountyEscrow } from '@/hooks/useBountyEscrow';
import { qk } from '@/lib/constants/queryKeys';
import { getGroup, listMyMemberships } from '@/lib/services/groupService';
import { haptic } from '@/lib/utils/haptic';
import { parseSolAmount, formatSol } from '@/lib/utils/formatNumber';
import { getConnection, lamportsToSol, solToLamports } from '@/lib/solana/connection';
import type { BountySubmissionKind } from '@/lib/types/bounty';
import type { Group } from '@/lib/types/group';

// Reserve to cover the ~5,000-lamport tx fee plus the escrow PDA rent
// (small Anchor account: ~890k lamports). 2× margin keeps headroom for
// small priority-fee surprises.
const BOUNTY_FEE_RESERVE_LAMPORTS = 2_000_000;
const BOUNTY_FEE_RESERVE_SOL = BOUNTY_FEE_RESERVE_LAMPORTS / LAMPORTS_PER_SOL;
const INSUFFICIENT_FUNDS_RE = /insufficient.*(fund|lamport|fee)|fee.*lamport/i;

const KIND_TABS = ['Photo', 'Video', 'Link'] as const;
const KIND_ICONS = ['photo', 'video.fill', 'link'] as const;
type KindTab = (typeof KIND_TABS)[number];

function tabToKind(t: KindTab): BountySubmissionKind {
    return t === 'Photo' ? 'photo' : t === 'Video' ? 'video' : 'link';
}
function kindToTab(k: BountySubmissionKind): KindTab {
    return k === 'photo' ? 'Photo' : k === 'video' ? 'Video' : 'Link';
}

interface PostBountySheetProps {
    visible: boolean;
    onClose: () => void;
}

export function PostBountySheet({ visible, onClose }: PostBountySheetProps) {
    const queryClient = useQueryClient();
    const { theme } = useTheme();
    const { user, walletAddress } = useAuth();
    const { post, pending } = useBountyEscrow();
    const [kind, setKind] = useState<BountySubmissionKind>('photo');
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [amountText, setAmountText] = useState('');
    const [scopeGroupId, setScopeGroupId] = useState<string | null>(null);
    const [submitState, setSubmitState] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const membershipsQuery = useQuery({
        queryKey: user ? qk.groups.myMemberships(user.id) : ['groups', 'myMemberships', 'anon'],
        queryFn: () => (user ? listMyMemberships(user.id) : Promise.resolve([])),
        staleTime: 60_000,
        enabled: !!user && visible,
    });
    const myGroupIds = useMemo(
        () => (membershipsQuery.data ?? []).map((m) => m.groupId),
        [membershipsQuery.data],
    );
    const myGroupsQuery = useQuery({
        queryKey: ['groups', 'byIds', [...myGroupIds].sort()],
        queryFn: async () => {
            const groups = await Promise.all(myGroupIds.map((id) => getGroup(id)));
            return groups.filter((g): g is Group => !!g);
        },
        staleTime: 60_000,
        enabled: visible && myGroupIds.length > 0,
    });
    // Only `active` groups can host new bounties. Pending groups (newly
    // provisioned but not yet activated by the Adler team) are excluded
    // from the scope picker so the admin can't accidentally post into one.
    const myGroups = useMemo(
        () => (myGroupsQuery.data ?? []).filter((g) => g.status === 'active'),
        [myGroupsQuery.data],
    );
    const canPickGroup = myGroups.length > 0;
    const selectedGroup = scopeGroupId ? myGroups.find((g) => g.id === scopeGroupId) ?? null : null;

    const balanceQuery = useQuery({
        queryKey: walletAddress ? qk.wallet.balance(walletAddress) : ['wallet', 'balance', 'none'],
        enabled: !!walletAddress && visible,
        queryFn: async () => {
            if (!walletAddress) return 0;
            const lamports = await getConnection().getBalance(new PublicKey(walletAddress));
            return lamportsToSol(lamports);
        },
        staleTime: 15_000,
    });
    const balanceLoaded = balanceQuery.data !== undefined && !balanceQuery.isLoading;
    const balanceSol = balanceQuery.data ?? 0;
    const maxBountySol = Math.max(0, balanceSol - BOUNTY_FEE_RESERVE_SOL);

    // Reset on every open.
    useEffect(() => {
        if (!visible) return;
        setKind('photo');
        setTitle('');
        setPrompt('');
        setAmountText('');
        setScopeGroupId(null);
        setSubmitState('idle');
        setErrorMessage(null);
    }, [visible]);

    const amountSol = parseSolAmount(amountText);
    // Auto-shrink the KPI digits so long numbers never clip horizontally.
    const amountFontSize = (() => {
        const len = Math.max(amountText.length || 1, 1);
        if (len <= 4) return 56;
        if (len <= 6) return 48;
        if (len <= 7) return 40;
        return 32;
    })();
    const exceedsBalance =
        balanceLoaded && amountSol !== null && amountSol > 0 && amountSol > maxBountySol;
    const canSubmit =
        !pending &&
        title.trim().length > 0 &&
        prompt.trim().length > 0 &&
        amountSol !== null &&
        amountSol > 0 &&
        !exceedsBalance;

    const fail = (msg: string) => {
        haptic('error');
        setErrorMessage(msg);
        setSubmitState('error');
        setTimeout(() => {
            setSubmitState('idle');
            setErrorMessage(null);
        }, 2500);
    };

    const onSubmit = async (close: (cb?: () => void) => void) => {
        if (!canSubmit || amountSol === null) return;
        try {
            if (walletAddress) {
                await queryClient.refetchQueries({ queryKey: qk.wallet.balance(walletAddress) });
                const fresh = queryClient.getQueryData<number>(qk.wallet.balance(walletAddress)) ?? 0;
                const maxFresh = Math.max(0, fresh - BOUNTY_FEE_RESERVE_SOL);
                if (amountSol > maxFresh) {
                    fail('Not enough funds');
                    return;
                }
            }
            haptic('medium');
            const bounty = await post({
                title: title.trim(),
                prompt: prompt.trim(),
                bountyLamports: solToLamports(amountSol),
                scope: scopeGroupId ? 'group' : 'public',
                groupId: scopeGroupId,
                submissionKind: kind,
            });
            haptic('heavy');
            await queryClient.invalidateQueries({ queryKey: qk.bounties.all() });
            setSubmitState('success');
            // Hold the green confirmation briefly so users can register it
            // before we close the sheet and navigate to the new bounty.
            setTimeout(() => {
                close(() => {
                    router.push(`/bounty/${bounty.id}`);
                });
            }, 900);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (INSUFFICIENT_FUNDS_RE.test(msg)) {
                fail('Not enough funds');
            } else {
                fail(msg || "Couldn't publish bounty");
            }
        }
    };

    const promptPlaceholder =
        kind === 'link'
            ? 'What link should submitters send? (e.g. a GitHub repo)'
            : kind === 'video'
              ? 'What does a winning video show?'
              : 'What counts as a valid submission?';

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            title="Post a bounty"
            height={560}
            keyboardAware
        >
            {({ close }) => (
                <View style={{ flex: 1, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 16, gap: 16 }}>
                    {/* Reward KPI — single horizontal group, auto-shrinks */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            paddingVertical: 8,
                        }}
                    >
                        <View style={{ flexShrink: 1, flexGrow: 0 }}>
                            <NumberInput
                                value={amountText}
                                onChangeText={setAmountText}
                                placeholder="0"
                                autoFocus
                                maxLength={9}
                                inputStyle={{
                                    fontSize: amountFontSize,
                                    lineHeight: Math.round(amountFontSize * 1.25),
                                    height: Math.round(amountFontSize * 1.4),
                                    minWidth: 0,
                                }}
                            />
                        </View>
                        <SolanaIcon size={Math.round(amountFontSize * 0.46)} />
                    </View>

                    {exceedsBalance ? (
                        <ThemedText
                            type="body-sm"
                            style={{ color: theme[500], textAlign: 'center', marginTop: -8 }}
                        >
                            {`Reserve ~${BOUNTY_FEE_RESERVE_SOL.toFixed(3)} SOL for the network fee.`}
                        </ThemedText>
                    ) : null}

                    <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <ThemedText type="body-sm-semibold" style={{ color: theme[950], flex: 1 }}>
                                Where should it be posted?
                            </ThemedText>
                            {canPickGroup ? (
                                <PopoverMenu
                                    items={[
                                        {
                                            label: 'Public',
                                            icon: ({ size, color }) => (
                                                <Icon name="globe" size={size} color={color} />
                                            ),
                                            selected: scopeGroupId === null,
                                            onPress: () => setScopeGroupId(null),
                                        },
                                        ...myGroups.map((g) => ({
                                            label: g.name,
                                            icon: ({ size, color }: { size: number; color: string }) => (
                                                <Icon name="person.2.fill" size={size} color={color} />
                                            ),
                                            selected: scopeGroupId === g.id,
                                            onPress: () => setScopeGroupId(g.id),
                                        })),
                                    ]}
                                >
                                    <ScopeChip
                                        label={selectedGroup ? selectedGroup.name : 'Public'}
                                        iconName={selectedGroup ? 'person.2.fill' : 'globe'}
                                        trailingIcon="chevron.down"
                                        theme={theme}
                                    />
                                </PopoverMenu>
                            ) : (
                                <ScopeChip
                                    label="Public"
                                    iconName="globe"
                                    trailingIcon="lock.fill"
                                    locked
                                    theme={theme}
                                />
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <ThemedText type="body-sm-semibold" style={{ color: theme[950], flex: 1 }}>
                                What’s the format of the submission?
                            </ThemedText>
                            <View style={{ width: 96 }}>
                                <SegmentedToggle
                                    tabs={KIND_TABS}
                                    icons={KIND_ICONS}
                                    activeTab={kindToTab(kind)}
                                    onTabChange={(t) => setKind(tabToKind(t))}
                                    size="xs"
                                    backgroundColor={theme[200]}
                                    activeColor={theme[50]}
                                    activeForegroundColor={TailwindColors.sky[500]}
                                    inactiveForegroundColor={theme[300]}
                                />
                            </View>
                        </View>
                    </View>

                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Bounty title"
                        maxLength={80}
                        returnKeyType="next"
                        style={{ height: 48 }}
                    />

                    <TextInput
                        value={prompt}
                        onChangeText={setPrompt}
                        placeholder={promptPlaceholder}
                        multiline
                        maxLength={300}
                        style={{ height: 88, textAlignVertical: 'top' }}
                    />

                    <View style={{ marginTop: 'auto' }}>
                        <SubmitButton
                            idleLabel={
                                amountSol && amountSol > 0
                                    ? `Post ${formatSol(amountSol)} SOL`
                                    : 'Post bounty'
                            }
                            loadingLabel="Posting…"
                            successLabel="Bounty posted"
                            errorLabel={errorMessage ?? "Couldn't publish bounty"}
                            state={submitState}
                            loading={pending}
                            disabled={!canSubmit}
                            onPress={() => onSubmit(close)}
                        />
                    </View>
                </View>
            )}
        </BottomSheet>
    );
}

interface ScopeChipProps {
    label: string;
    iconName: 'globe' | 'person.2.fill';
    trailingIcon: 'chevron.down' | 'lock.fill';
    locked?: boolean;
    theme: ReturnType<typeof useTheme>['theme'];
}

function ScopeChip({ label, iconName, trailingIcon, locked, theme }: ScopeChipProps) {
    return (
        <View
            pointerEvents="none"
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: Radius.full,
                backgroundColor: theme[200],
                opacity: locked ? 0.7 : 1,
                maxWidth: 160,
            }}
        >
            <Icon name={iconName} size={13} color={theme[700]} />
            <ThemedText
                type="caption-semibold"
                style={{ color: theme[900] }}
                numberOfLines={1}
            >
                {label}
            </ThemedText>
            <Icon name={trailingIcon} size={11} color={theme[500]} />
        </View>
    );
}

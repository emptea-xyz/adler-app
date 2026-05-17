import React, { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { PopoverMenu, type PopoverMenuItem } from '@/components/ui/PopoverMenu';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { Alert } from '@/components/ui/Alert';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SolanaIcon } from '@/components/ui/SolanaIcon';
import TextInput from '@/components/ui/TextInput';
import { BountyCardForBounty } from '@/components/features/bounty/BountyItemCard';
import { GroupLogoDot } from '@/components/features/bounty/BountyTags';
import { GroupEditSheet } from '@/components/features/groups/GroupEditSheet';
import { AddMemberSheet } from '@/components/features/groups/AddMemberSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
    approveJoinRequest,
    getGroup,
    getMyJoinRequest,
    getMyMembership,
    leaveGroup,
    listGroupMembers,
    listJoinRequests,
    rejectJoinRequest,
    removeGroupMember,
    requestToJoinGroup,
    transferGroupOwnership,
} from '@/lib/services/groupService';
import { listGroupBounties } from '@/lib/services/bountyService';
import { getProfile } from '@/lib/services/profileService';
import { getPreferences, setGroupMute } from '@/lib/services/preferencesService';
import { qk } from '@/lib/constants/queryKeys';
import {
    EMPTY_GROUP_BOUNTIES,
    EMPTY_GROUP_JOIN_REQUESTS,
    EMPTY_GROUP_MEMBERS,
    GROUP_CONTACT_MAILTO,
    GROUP_NOT_READY,
} from '@/lib/utils/copy';
import { toast, toastError } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { formatSol } from '@/lib/utils/formatNumber';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { TailwindColors } from '@/constants/TailwindColors';
import type { Group, GroupMember, JoinRequest } from '@/lib/types/group';
import type { UserPreferences } from '@/lib/types/preferences';

type GroupTab = 'bounties' | 'members';

export default function GroupDetailScreen() {
    const { id: idParam } = useLocalSearchParams<{ id: string }>();
    const id = String(idParam ?? '');
    const { theme } = useTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<GroupTab>('bounties');
    const [editOpen, setEditOpen] = useState(false);
    const [addMemberOpen, setAddMemberOpen] = useState(false);
    const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');

    const groupQuery = useQuery({
        queryKey: qk.groups.detail(id),
        queryFn: () => getGroup(id),
        enabled: !!id,
        staleTime: 30_000,
    });
    const group = groupQuery.data ?? null;

    const myMembershipQuery = useQuery({
        queryKey: user
            ? qk.groups.myMembership(id, user.id)
            : ['groups', 'myMembership', 'anon'],
        queryFn: () =>
            user && id ? getMyMembership(id, user.id) : Promise.resolve(null),
        enabled: !!user && !!id,
        staleTime: 30_000,
    });
    const myMembership = myMembershipQuery.data ?? null;
    const isMember = !!myMembership;
    const isAdmin = myMembership?.role === 'admin';
    const membershipKnown = !myMembershipQuery.isLoading;
    const isActive = group?.status === 'active';

    const myJoinRequestQuery = useQuery({
        queryKey: user
            ? qk.groups.myJoinRequest(id, user.id)
            : ['groups', 'myJoinRequest', 'anon'],
        queryFn: () => (user ? getMyJoinRequest(id, user.id) : Promise.resolve(null)),
        enabled: !!user && !!id && isActive && !isMember,
        staleTime: 30_000,
    });
    const hasPendingRequest = !!myJoinRequestQuery.data;

    const bountiesQuery = useQuery({
        queryKey: qk.bounties.listGroup([id], 'open'),
        queryFn: () => listGroupBounties([id]),
        enabled: !!id && isActive,
        staleTime: 30_000,
    });

    const membersQuery = useQuery({
        queryKey: qk.groups.members(id),
        queryFn: () => listGroupMembers(id),
        enabled: !!id && tab === 'members' && isActive,
        staleTime: 60_000,
    });

    const joinRequestsQuery = useQuery({
        queryKey: qk.groups.joinRequests(id),
        queryFn: () => listJoinRequests(id),
        enabled: !!id && tab === 'members' && isActive && isAdmin,
        staleTime: 30_000,
    });

    const ownerQuery = useQuery({
        queryKey: qk.profiles.detail(group?.ownerId ?? 'unknown'),
        queryFn: () =>
            group?.ownerId ? getProfile(group.ownerId) : Promise.resolve(null),
        enabled: !!group?.ownerId,
        staleTime: 5 * 60_000,
    });
    const owner = ownerQuery.data ?? null;

    const preferencesQuery = useQuery({
        queryKey: user ? qk.preferences.detail(user.id) : ['preferences', 'detail', 'anon'],
        queryFn: () => (user ? getPreferences(user.id) : Promise.resolve(null)),
        enabled: !!user,
        staleTime: 60_000,
    });
    const isMuted = !!preferencesQuery.data?.mutedGroups?.includes(id);

    const requestMutation = useMutation({
        mutationFn: () => requestToJoinGroup({ groupId: id }),
        onSuccess: (res) => {
            haptic('medium');
            toast.success(res.alreadyPending ? 'Already requested' : 'Request sent');
            if (user) {
                queryClient.invalidateQueries({
                    queryKey: qk.groups.myJoinRequest(id, user.id),
                });
            }
            queryClient.invalidateQueries({ queryKey: qk.groups.joinRequests(id) });
        },
        onError: (err) => {
            toastError(err, 'Could not send request');
        },
    });

    const muteMutation = useMutation({
        mutationFn: (next: boolean) =>
            user ? setGroupMute(user.id, id, next) : Promise.reject(new Error('Sign in required')),
        onMutate: async (next) => {
            if (!user) return { prev: undefined as UserPreferences | undefined };
            const key = qk.preferences.detail(user.id);
            await queryClient.cancelQueries({ queryKey: key });
            const prev = queryClient.getQueryData<UserPreferences>(key);
            if (prev) {
                const list = prev.mutedGroups ?? [];
                const updated = next
                    ? Array.from(new Set([...list, id]))
                    : list.filter((g) => g !== id);
                queryClient.setQueryData<UserPreferences>(key, {
                    ...prev,
                    mutedGroups: updated,
                });
            }
            return { prev };
        },
        onError: (err, _next, ctx) => {
            if (user && ctx?.prev) {
                queryClient.setQueryData(qk.preferences.detail(user.id), ctx.prev);
            }
            toastError(err, 'Could not update mute');
        },
        onSuccess: (_data, next) => {
            haptic('medium');
            toast.success(next ? 'Group muted' : 'Group unmuted');
            if (user) {
                queryClient.invalidateQueries({ queryKey: qk.preferences.detail(user.id) });
            }
        },
    });

    const leaveMutation = useMutation({
        mutationFn: () => leaveGroup({ groupId: id }),
        onSuccess: () => {
            haptic('heavy');
            toast.success('Left group');
            queryClient.invalidateQueries({ queryKey: qk.groups.members(id) });
            queryClient.invalidateQueries({ queryKey: qk.groups.detail(id) });
            queryClient.invalidateQueries({ queryKey: ['groups', 'myMemberships'] });
            queryClient.invalidateQueries({ queryKey: ['groups', 'myMembership', id] });
            router.back();
        },
        onError: (err) => {
            toastError(err, "Couldn't leave");
        },
    });

    const onRefresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: qk.groups.detail(id) }),
            queryClient.invalidateQueries({ queryKey: qk.bounties.listGroup([id], 'open') }),
            queryClient.invalidateQueries({ queryKey: qk.groups.members(id) }),
            queryClient.invalidateQueries({ queryKey: qk.groups.joinRequests(id) }),
            queryClient.invalidateQueries({ queryKey: ['groups', 'myMembership', id] }),
            user
                ? queryClient.invalidateQueries({
                      queryKey: qk.groups.myJoinRequest(id, user.id),
                  })
                : Promise.resolve(),
            user
                ? queryClient.invalidateQueries({
                      queryKey: qk.preferences.detail(user.id),
                  })
                : Promise.resolve(),
        ]);
    };

    const shareGroup = async () => {
        if (!group) return;
        const url = `adler://group/${group.id}`;
        const message = `Join "${group.name}" on Adler\n${url}`;
        haptic('light');
        try {
            await Share.share({ message });
        } catch {
            try {
                await Clipboard.setStringAsync(url);
                toast.success('Link copied');
            } catch (clipErr) {
                toastError(clipErr, 'Could not share');
            }
        }
    };

    const members = membersQuery.data ?? [];
    const adminCount = members.filter((m) => m.role === 'admin').length;
    const isLastAdmin = isAdmin && adminCount <= 1;

    const allBounties = bountiesQuery.data ?? [];
    const pinned = group?.pinnedBountyId
        ? allBounties.find((b) => b.id === group.pinnedBountyId) ?? null
        : null;
    const bountiesData = useMemo(
        () => (pinned ? allBounties.filter((b) => b.id !== pinned.id) : allBounties),
        [allBounties, pinned],
    );
    const openBountyCount = allBounties.length;
    const openBountyTotalSol = (group?.openBountyTotalLamports ?? 0) / 1e9;

    if (groupQuery.isLoading) {
        return (
            <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
                <ScreenHeader title="Group" />
                <View style={{ padding: 16, gap: 12 }}>
                    <Skeleton height={92} />
                    <Skeleton height={48} />
                    <Skeleton height={84} />
                </View>
            </ThemedView>
        );
    }

    if (!group) {
        return (
            <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
                <ScreenHeader title="Group" />
                <View style={{ padding: 24, alignItems: 'center' }}>
                    <EmptyState
                        title="Group not found"
                        description="It may have been removed or the link is broken."
                    />
                    <View style={{ marginTop: 24, width: '100%' }}>
                        <Button title="Back" variant="secondary" onPress={() => router.back()} />
                    </View>
                </View>
            </ThemedView>
        );
    }

    if (!isActive) {
        return (
            <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
                <ScreenHeader title={group.name || 'Group'} />
                <View
                    style={{
                        flex: 1,
                        paddingHorizontal: 24,
                        paddingTop: 48,
                        gap: 20,
                        alignItems: 'center',
                    }}
                >
                    <View
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: 36,
                            backgroundColor: theme[100],
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Icon name="clock.fill" size={36} color={theme[500]} />
                    </View>
                    <ThemedText type="h3" style={{ color: theme[950], textAlign: 'center' }}>
                        {GROUP_NOT_READY.title}
                    </ThemedText>
                    <ThemedText
                        type="body-md"
                        style={{ color: theme[600], textAlign: 'center', lineHeight: 22 }}
                    >
                        {GROUP_NOT_READY.description}
                    </ThemedText>
                    <View style={{ marginTop: 8, width: '100%' }}>
                        <Button
                            title={GROUP_NOT_READY.cta}
                            variant="secondary"
                            onPress={() => {
                                haptic('light');
                                Linking.openURL(
                                    `${GROUP_CONTACT_MAILTO}?subject=${encodeURIComponent(
                                        `Group setup: ${group.id}`,
                                    )}`,
                                ).catch(() => {
                                    if (__DEV__) console.warn('mailto open failed');
                                });
                            }}
                        />
                    </View>
                </View>
            </ThemedView>
        );
    }

    const tabs = ['Bounties', 'Members'] as const;
    const activeTabLabel = tab === 'bounties' ? 'Bounties' : 'Members';
    const pendingRequests = joinRequestsQuery.data ?? [];

    const popoverItems: PopoverMenuItem[] = [];
    if (isAdmin) {
        popoverItems.push({
            label: 'Edit group',
            onPress: () => {
                haptic('light');
                setEditOpen(true);
            },
        });
    }
    if (isMember && !isLastAdmin) {
        popoverItems.push({
            label: 'Leave group',
            destructive: true,
            onPress: () => setLeaveConfirmOpen(true),
        });
    }

    const filteredMembers = membersQuery.isLoading
        ? []
        : members.filter((m) => filterMember(m, memberSearch, queryClient));
    const adminMembers = filteredMembers.filter((m) => m.role === 'admin');
    const regularMembers = filteredMembers.filter((m) => m.role !== 'admin');

    return (
        <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
            <ScreenHeader title={group.name} />

            <FlatList
                data={tab === 'bounties' ? bountiesData : []}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <BountyCardForBounty bounty={item} />}
                contentContainerStyle={{
                    paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={
                            bountiesQuery.isFetching ||
                            membersQuery.isFetching ||
                            joinRequestsQuery.isFetching
                        }
                        onRefresh={onRefresh}
                        tintColor={theme[950]}
                    />
                }
                ListHeaderComponent={
                    <View>
                        {/* Hero */}
                        <View
                            style={{
                                paddingHorizontal: 16,
                                paddingTop: 8,
                                paddingBottom: 8,
                                gap: 12,
                                alignItems: 'center',
                            }}
                        >
                            <GroupLogoDot
                                name={group.name}
                                logoUrl={group.logoUrl ?? null}
                                size={88}
                            />
                            <View style={{ gap: 4, alignItems: 'center' }}>
                                <ThemedText
                                    type="h2"
                                    style={{ color: theme[950], textAlign: 'center' }}
                                >
                                    {group.name}
                                </ThemedText>
                                <StatsRow
                                    memberCount={group.memberCount}
                                    openCount={openBountyCount}
                                    openSol={openBountyTotalSol}
                                />
                                <OwnerLine
                                    ownerUsername={owner?.username ?? null}
                                    createdAt={group.createdAt}
                                />
                            </View>
                        </View>

                        {/* Action row */}
                        <View
                            style={{
                                paddingHorizontal: 16,
                                paddingTop: 8,
                                paddingBottom: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                {!membershipKnown ? (
                                    <Skeleton height={48} />
                                ) : !isMember ? (
                                    <Button
                                        title={
                                            hasPendingRequest ? 'Request pending' : 'Request to join'
                                        }
                                        variant={hasPendingRequest ? 'secondary' : 'primary'}
                                        disabled={
                                            hasPendingRequest || requestMutation.isPending
                                        }
                                        loading={requestMutation.isPending}
                                        onPress={() => {
                                            haptic('medium');
                                            requestMutation.mutate();
                                        }}
                                    />
                                ) : (
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8,
                                        }}
                                    >
                                        {isAdmin ? (
                                            <Pill
                                                intent="info"
                                                label="ADMIN"
                                                icon="shield.fill"
                                            />
                                        ) : (
                                            <Pill
                                                intent="success"
                                                label="MEMBER"
                                                icon="person.fill"
                                            />
                                        )}
                                        {isMuted ? (
                                            <Pill
                                                intent="neutral"
                                                label="MUTED"
                                                icon="bell.slash.fill"
                                            />
                                        ) : null}
                                    </View>
                                )}
                            </View>
                            {isMember ? (
                                <ActionIconButton
                                    icon={isMuted ? 'bell.slash.fill' : 'bell.fill'}
                                    onPress={() => muteMutation.mutate(!isMuted)}
                                    disabled={muteMutation.isPending}
                                    accessibilityLabel={isMuted ? 'Unmute group' : 'Mute group'}
                                />
                            ) : null}
                            <ActionIconButton
                                icon="square.and.arrow.up"
                                onPress={shareGroup}
                                accessibilityLabel="Share group"
                            />
                            {popoverItems.length > 0 ? (
                                <PopoverMenu items={popoverItems}>
                                    <ActionIconButton
                                        icon="ellipsis"
                                        onPress={() => {}}
                                        accessibilityLabel="More group actions"
                                    />
                                </PopoverMenu>
                            ) : null}
                        </View>

                        {/* About / Rules */}
                        {(group.description || group.rules) ? (
                            <View
                                style={{
                                    marginHorizontal: 16,
                                    marginBottom: 12,
                                    padding: 16,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: theme[200],
                                    backgroundColor: theme[50],
                                    gap: 16,
                                }}
                            >
                                {group.description ? (
                                    <View style={{ gap: 6 }}>
                                        <SectionLabel label="About" />
                                        <ThemedText
                                            type="body-sm"
                                            style={{ color: theme[800], lineHeight: 20 }}
                                        >
                                            {group.description}
                                        </ThemedText>
                                    </View>
                                ) : null}
                                {group.rules ? (
                                    <View style={{ gap: 6 }}>
                                        <SectionLabel label="Rules" />
                                        <ThemedText
                                            type="body-sm"
                                            style={{ color: theme[800], lineHeight: 20 }}
                                        >
                                            {group.rules}
                                        </ThemedText>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}

                        {/* Tabs */}
                        <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
                            <SegmentedToggle
                                tabs={tabs}
                                activeTab={activeTabLabel as (typeof tabs)[number]}
                                onTabChange={(t) =>
                                    setTab(t === 'Bounties' ? 'bounties' : 'members')
                                }
                                size="md"
                            />
                        </View>

                        {/* Bounties tab: pinned bounty */}
                        {tab === 'bounties' && pinned ? (
                            <View style={{ paddingTop: 4, paddingBottom: 8 }}>
                                <View
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingTop: 4,
                                        paddingBottom: 8,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                    }}
                                >
                                    <Icon name="pin.fill" size={12} color={theme[500]} />
                                    <SectionLabel label="Pinned" />
                                </View>
                                <BountyCardForBounty bounty={pinned} />
                                <View
                                    style={{
                                        marginHorizontal: 16,
                                        marginTop: 4,
                                        marginBottom: 8,
                                        height: 1,
                                        backgroundColor: theme[200],
                                    }}
                                />
                            </View>
                        ) : null}

                        {/* Bounties tab: empty state when no bounties at all */}
                        {tab === 'bounties' &&
                        !bountiesQuery.isLoading &&
                        allBounties.length === 0 ? (
                            <View style={{ paddingTop: 24 }}>
                                <EmptyState
                                    title={EMPTY_GROUP_BOUNTIES.title}
                                    description={EMPTY_GROUP_BOUNTIES.description}
                                />
                            </View>
                        ) : null}

                        {/* Members tab */}
                        {tab === 'members' ? (
                            <View style={{ paddingTop: 4 }}>
                                {/* Pending requests (admins only) */}
                                {isAdmin ? (
                                    <View style={{ paddingBottom: 12 }}>
                                        <View
                                            style={{
                                                paddingHorizontal: 16,
                                                paddingTop: 4,
                                                paddingBottom: 8,
                                            }}
                                        >
                                            <SectionLabel
                                                label={
                                                    pendingRequests.length > 0
                                                        ? `Pending requests · ${pendingRequests.length}`
                                                        : 'Pending requests'
                                                }
                                            />
                                        </View>
                                        {joinRequestsQuery.isLoading ? (
                                            <View
                                                style={{ paddingHorizontal: 16, gap: 12 }}
                                            >
                                                <Skeleton height={56} />
                                            </View>
                                        ) : pendingRequests.length === 0 ? (
                                            <View
                                                style={{
                                                    paddingHorizontal: 16,
                                                    paddingBottom: 4,
                                                }}
                                            >
                                                <ThemedText
                                                    type="body-sm"
                                                    style={{ color: theme[500] }}
                                                >
                                                    {EMPTY_GROUP_JOIN_REQUESTS.description}
                                                </ThemedText>
                                            </View>
                                        ) : (
                                            pendingRequests.map((r) => (
                                                <JoinRequestRow
                                                    key={r.id}
                                                    request={r}
                                                    group={group}
                                                />
                                            ))
                                        )}
                                    </View>
                                ) : null}

                                {/* Member search */}
                                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                                    <TextInput
                                        value={memberSearch}
                                        onChangeText={setMemberSearch}
                                        placeholder="Search members"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        returnKeyType="search"
                                        leftIcon={
                                            <Icon
                                                name="magnifyingglass"
                                                size={16}
                                                color={theme[400]}
                                            />
                                        }
                                    />
                                </View>

                                {membersQuery.isLoading ? (
                                    <View style={{ paddingHorizontal: 16, gap: 12 }}>
                                        {[0, 1, 2].map((k) => (
                                            <Skeleton key={k} height={56} />
                                        ))}
                                    </View>
                                ) : membersQuery.isError ? (
                                    <View
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 12,
                                        }}
                                    >
                                        <ThemedText
                                            type="body-sm"
                                            style={{ color: theme[500] }}
                                        >
                                            Couldn&apos;t load members. Pull to retry.
                                        </ThemedText>
                                    </View>
                                ) : members.length === 0 ? (
                                    <EmptyState
                                        title={EMPTY_GROUP_MEMBERS.title}
                                        description={EMPTY_GROUP_MEMBERS.description}
                                    />
                                ) : (
                                    <View>
                                        {adminMembers.length > 0 ? (
                                            <View>
                                                <View
                                                    style={{
                                                        paddingHorizontal: 16,
                                                        paddingTop: 4,
                                                        paddingBottom: 8,
                                                    }}
                                                >
                                                    <SectionLabel
                                                        label={`Admins · ${adminMembers.length}`}
                                                    />
                                                </View>
                                                {adminMembers.map((m) => (
                                                    <MemberRow
                                                        key={m.id}
                                                        member={m}
                                                        group={group}
                                                        members={members}
                                                        viewerIsAdmin={isAdmin}
                                                        viewerUid={user?.id ?? null}
                                                    />
                                                ))}
                                            </View>
                                        ) : null}
                                        {regularMembers.length > 0 ? (
                                            <View style={{ paddingTop: 8 }}>
                                                <View
                                                    style={{
                                                        paddingHorizontal: 16,
                                                        paddingTop: 4,
                                                        paddingBottom: 8,
                                                    }}
                                                >
                                                    <SectionLabel
                                                        label={`Members · ${regularMembers.length}`}
                                                    />
                                                </View>
                                                {regularMembers.map((m) => (
                                                    <MemberRow
                                                        key={m.id}
                                                        member={m}
                                                        group={group}
                                                        members={members}
                                                        viewerIsAdmin={isAdmin}
                                                        viewerUid={user?.id ?? null}
                                                    />
                                                ))}
                                            </View>
                                        ) : null}
                                        {filteredMembers.length === 0 &&
                                        memberSearch.trim() ? (
                                            <View
                                                style={{
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 24,
                                                }}
                                            >
                                                <ThemedText
                                                    type="body-sm"
                                                    style={{
                                                        color: theme[500],
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    No members match &ldquo;{memberSearch}&rdquo;.
                                                </ThemedText>
                                            </View>
                                        ) : null}
                                        {isAdmin ? (
                                            <Pressable
                                                onPress={() => {
                                                    haptic('light');
                                                    setAddMemberOpen(true);
                                                }}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 14,
                                                    borderTopWidth: 1,
                                                    borderTopColor: theme[100],
                                                }}
                                                accessibilityRole="button"
                                                accessibilityLabel="Add a member"
                                            >
                                                <View
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: 16,
                                                        backgroundColor: theme[100],
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <Icon
                                                        name="plus"
                                                        size={16}
                                                        color={theme[700]}
                                                    />
                                                </View>
                                                <ThemedText
                                                    type="body-md-semibold"
                                                    style={{ color: theme[950] }}
                                                >
                                                    Add member
                                                </ThemedText>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                )}
                            </View>
                        ) : null}
                    </View>
                }
            />

            <GroupEditSheet
                visible={editOpen}
                onClose={() => setEditOpen(false)}
                group={group}
            />
            <AddMemberSheet
                visible={addMemberOpen}
                onClose={() => setAddMemberOpen(false)}
                groupId={group.id}
            />
            <Alert
                visible={leaveConfirmOpen}
                title="Leave group?"
                message={`You'll lose access to ${group.name}'s bounties.`}
                confirmText="Leave"
                cancelText="Cancel"
                isDestructive
                onCancel={() => setLeaveConfirmOpen(false)}
                onConfirm={() => {
                    setLeaveConfirmOpen(false);
                    leaveMutation.mutate();
                }}
            />
        </ThemedView>
    );
}

function StatsRow({
    memberCount,
    openCount,
    openSol,
}: {
    memberCount: number;
    openCount: number;
    openSol: number;
}) {
    const { theme } = useTheme();
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                justifyContent: 'center',
            }}
        >
            <ThemedText type="caption" style={{ color: theme[500] }}>
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme[400] }}>
                ·
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme[500] }}>
                {openCount} open
            </ThemedText>
            {openSol > 0 ? (
                <>
                    <ThemedText type="caption" style={{ color: theme[400] }}>
                        ·
                    </ThemedText>
                    <View
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                    >
                        <ThemedText
                            type="caption-semibold"
                            style={{
                                color: TailwindColors.sky[500],
                                letterSpacing: -0.2,
                            }}
                        >
                            {formatSol(openSol)}
                        </ThemedText>
                        <SolanaIcon size={10} color={TailwindColors.sky[500]} />
                        <ThemedText type="caption" style={{ color: theme[500] }}>
                            up
                        </ThemedText>
                    </View>
                </>
            ) : null}
        </View>
    );
}

function OwnerLine({
    ownerUsername,
    createdAt,
}: {
    ownerUsername: string | null;
    createdAt: number;
}) {
    const { theme } = useTheme();
    if (!ownerUsername) return null;
    let createdLabel = '';
    try {
        createdLabel = new Intl.DateTimeFormat('en-US', {
            month: 'short',
            year: 'numeric',
        }).format(new Date(createdAt));
    } catch {
        createdLabel = '';
    }
    return (
        <ThemedText
            type="caption"
            style={{ color: theme[600], textAlign: 'center', marginTop: 2 }}
        >
            Founded by @{ownerUsername}
            {createdLabel ? ` · ${createdLabel}` : ''}
        </ThemedText>
    );
}

function ActionIconButton({
    icon,
    onPress,
    disabled,
    accessibilityLabel,
}: {
    icon: IconName;
    onPress: () => void;
    disabled?: boolean;
    accessibilityLabel: string;
}) {
    const { theme } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: theme[200],
                backgroundColor: theme[50],
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
        >
            <Icon name={icon} size={18} color={theme[800]} />
        </Pressable>
    );
}

// Member search predicate. The display name + username come from the
// profile doc which we cache under qk.profiles.detail. We pull from the
// React Query cache so the search input stays snappy without re-running
// queries on every keystroke. Falls back to the uid suffix when no
// profile is cached yet — a freshly-loaded screen filters by uid until
// profile rows hydrate.
function filterMember(
    member: GroupMember,
    needle: string,
    queryClient: ReturnType<typeof useQueryClient>,
) {
    const q = needle.trim().toLowerCase();
    if (!q) return true;
    const profile = queryClient.getQueryData<{
        username?: string | null;
        displayName?: string | null;
    }>(qk.profiles.detail(member.uid));
    const username = profile?.username ?? '';
    const displayName = profile?.displayName ?? '';
    const tail = member.uid.slice(0, 6);
    return (
        username.toLowerCase().includes(q) ||
        displayName.toLowerCase().includes(q) ||
        tail.toLowerCase().includes(q)
    );
}

function MemberRow({
    member,
    group,
    members,
    viewerIsAdmin,
    viewerUid,
}: {
    member: GroupMember;
    group: Group;
    members: GroupMember[];
    viewerIsAdmin: boolean;
    viewerUid: string | null;
}) {
    const { theme } = useTheme();
    const queryClient = useQueryClient();
    const [confirmOpen, setConfirmOpen] = useState(false);

    const profileQuery = useQuery({
        queryKey: qk.profiles.detail(member.uid),
        queryFn: () => getProfile(member.uid),
        staleTime: 5 * 60_000,
    });
    const profile = profileQuery.data ?? null;
    const display = profile?.displayName || profile?.username || member.uid.slice(0, 6);

    const isSelf = viewerUid === member.uid;
    const adminCount = members.filter((m) => m.role === 'admin').length;
    const cannotRemoveLastAdmin = member.role === 'admin' && adminCount <= 1;
    const canRemove = (viewerIsAdmin || isSelf) && !cannotRemoveLastAdmin;

    const removeMutation = useMutation({
        mutationFn: () =>
            isSelf
                ? leaveGroup({ groupId: group.id })
                : removeGroupMember({ groupId: group.id, uid: member.uid }),
        onSuccess: () => {
            haptic('heavy');
            toast.success(isSelf ? 'Left group' : `${display} removed`);
            queryClient.invalidateQueries({ queryKey: qk.groups.members(group.id) });
            queryClient.invalidateQueries({ queryKey: qk.groups.detail(group.id) });
            queryClient.invalidateQueries({ queryKey: ['groups', 'myMemberships'] });
            queryClient.invalidateQueries({
                queryKey: ['groups', 'myMembership', group.id],
            });
        },
        onError: (err) => {
            toastError(err, isSelf ? "Couldn't leave" : 'Could not remove');
        },
    });

    const promoteMutation = useMutation({
        mutationFn: () =>
            transferGroupOwnership({ groupId: group.id, toUid: member.uid }),
        onSuccess: () => {
            haptic('heavy');
            toast.success(`${display} is now an admin`);
            queryClient.invalidateQueries({ queryKey: qk.groups.members(group.id) });
            queryClient.invalidateQueries({ queryKey: ['groups', 'myMemberships'] });
            queryClient.invalidateQueries({
                queryKey: ['groups', 'myMembership', group.id],
            });
        },
        onError: (err) => {
            toastError(err, 'Could not promote');
        },
    });

    const canPromote = viewerIsAdmin && !isSelf && member.role !== 'admin';

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: theme[100],
            }}
        >
            <Avatar
                avatarUrl={profile?.avatarUrl ?? null}
                initial={display.charAt(0)}
                size="sm"
            />
            <View style={{ flex: 1, gap: 2 }}>
                <ThemedText
                    type="body-md-semibold"
                    style={{ color: theme[950] }}
                    numberOfLines={1}
                >
                    {display}
                    {isSelf ? '  · you' : ''}
                </ThemedText>
                {profile?.username ? (
                    <ThemedText type="caption" style={{ color: theme[500] }}>
                        @{profile.username}
                    </ThemedText>
                ) : null}
            </View>
            {member.role === 'admin' ? (
                <Pill intent="info" label="ADMIN" icon="shield.fill" />
            ) : null}
            {canRemove || canPromote ? (
                <PopoverMenu
                    items={[
                        ...(canPromote
                            ? [
                                  {
                                      label: 'Make admin',
                                      onPress: () => promoteMutation.mutate(),
                                  },
                              ]
                            : []),
                        ...(canRemove
                            ? [
                                  {
                                      label: isSelf ? 'Leave group' : 'Remove from group',
                                      destructive: true,
                                      onPress: () => setConfirmOpen(true),
                                  },
                              ]
                            : []),
                    ]}
                >
                    <View
                        style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Icon name="ellipsis" size={18} color={theme[500]} />
                    </View>
                </PopoverMenu>
            ) : null}

            <Alert
                visible={confirmOpen}
                title={isSelf ? 'Leave group?' : `Remove ${display}?`}
                message={
                    isSelf
                        ? `You'll lose access to ${group.name}'s bounties.`
                        : `${display} will lose access to ${group.name}'s bounties.`
                }
                confirmText={isSelf ? 'Leave' : 'Remove'}
                cancelText="Cancel"
                isDestructive
                onCancel={() => setConfirmOpen(false)}
                onConfirm={() => {
                    setConfirmOpen(false);
                    removeMutation.mutate();
                }}
            />
        </View>
    );
}

function JoinRequestRow({ request, group }: { request: JoinRequest; group: Group }) {
    const { theme } = useTheme();
    const queryClient = useQueryClient();

    const profileQuery = useQuery({
        queryKey: qk.profiles.detail(request.uid),
        queryFn: () => getProfile(request.uid),
        staleTime: 5 * 60_000,
    });
    const profile = profileQuery.data ?? null;
    const display = profile?.displayName || profile?.username || request.uid.slice(0, 6);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: qk.groups.joinRequests(group.id) });
        queryClient.invalidateQueries({ queryKey: qk.groups.members(group.id) });
        queryClient.invalidateQueries({ queryKey: qk.groups.detail(group.id) });
        queryClient.invalidateQueries({
            queryKey: ['groups', 'myMembership', group.id],
        });
    };

    const approveMutation = useMutation({
        mutationFn: () => approveJoinRequest({ groupId: group.id, uid: request.uid }),
        onSuccess: () => {
            haptic('heavy');
            toast.success(`${display} approved`);
            invalidate();
        },
        onError: (err) => {
            toastError(err, 'Could not approve');
        },
    });

    const rejectMutation = useMutation({
        mutationFn: () => rejectJoinRequest({ groupId: group.id, uid: request.uid }),
        onSuccess: () => {
            haptic('medium');
            toast.success(`${display} declined`);
            invalidate();
        },
        onError: (err) => {
            toastError(err, 'Could not decline');
        },
    });

    const busy = approveMutation.isPending || rejectMutation.isPending;

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: theme[100],
            }}
        >
            <Avatar
                avatarUrl={profile?.avatarUrl ?? null}
                initial={display.charAt(0)}
                size="sm"
            />
            <View style={{ flex: 1, gap: 2 }}>
                <ThemedText
                    type="body-md-semibold"
                    style={{ color: theme[950] }}
                    numberOfLines={1}
                >
                    {display}
                </ThemedText>
                {profile?.username ? (
                    <ThemedText type="caption" style={{ color: theme[500] }}>
                        @{profile.username}
                    </ThemedText>
                ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                    title="Decline"
                    variant="tertiary"
                    size="sm"
                    onPress={() => rejectMutation.mutate()}
                    disabled={busy}
                />
                <Button
                    title="Approve"
                    variant="primary"
                    size="sm"
                    onPress={() => approveMutation.mutate()}
                    disabled={busy}
                    loading={approveMutation.isPending}
                />
            </View>
        </View>
    );
}


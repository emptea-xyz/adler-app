import React, { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { PopoverMenu } from '@/components/ui/PopoverMenu';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { Alert } from '@/components/ui/Alert';
import { Icon } from '@/components/ui/Icon';
import { SectionLabel } from '@/components/base/SectionLabel';
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
    listGroupMembers,
    listJoinRequests,
    listMyMemberships,
    rejectJoinRequest,
    removeGroupMember,
    requestToJoinGroup,
} from '@/lib/services/groupService';
import { listGroupBounties } from '@/lib/services/bountyService';
import { getProfile } from '@/lib/services/profileService';
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
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import type { Group, GroupMember, JoinRequest } from '@/lib/types/group';

type GroupTab = 'bounties' | 'members';

export default function GroupDetailScreen() {
    const { id: idParam } = useLocalSearchParams<{ id: string }>();
    const id = String(idParam ?? '');
    const { theme } = useTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<GroupTab>('members');
    const [editOpen, setEditOpen] = useState(false);
    const [addMemberOpen, setAddMemberOpen] = useState(false);

    const groupQuery = useQuery({
        queryKey: qk.groups.detail(id),
        queryFn: () => getGroup(id),
        enabled: !!id,
        staleTime: 30_000,
    });
    const group = groupQuery.data ?? null;

    const membershipsQuery = useQuery({
        queryKey: user ? qk.groups.myMemberships(user.id) : ['groups', 'myMemberships', 'anon'],
        queryFn: () => (user ? listMyMemberships(user.id) : Promise.resolve([])),
        enabled: !!user,
        staleTime: 60_000,
    });
    const myMembership = useMemo(
        () => (membershipsQuery.data ?? []).find((m) => m.groupId === id) ?? null,
        [membershipsQuery.data, id],
    );
    const isMember = !!myMembership;
    const isAdmin = myMembership?.role === 'admin';
    const isActive = group?.status === 'active';

    const myJoinRequestQuery = useQuery({
        queryKey: user ? qk.groups.myJoinRequest(id, user.id) : ['groups', 'myJoinRequest', 'anon'],
        queryFn: () => (user ? getMyJoinRequest(id, user.id) : Promise.resolve(null)),
        enabled: !!user && !!id && isActive && !isMember,
        staleTime: 30_000,
    });
    const hasPendingRequest = !!myJoinRequestQuery.data;

    const bountiesQuery = useQuery({
        queryKey: qk.bounties.listGroup([id], 'open'),
        queryFn: () => listGroupBounties([id]),
        enabled: !!id && tab === 'bounties' && isActive && isMember,
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

    const requestMutation = useMutation({
        mutationFn: () => requestToJoinGroup({ groupId: id }),
        onSuccess: (res) => {
            haptic('medium');
            toast.success(res.alreadyPending ? 'Already requested' : 'Request sent');
            if (user) {
                queryClient.invalidateQueries({ queryKey: qk.groups.myJoinRequest(id, user.id) });
            }
            queryClient.invalidateQueries({ queryKey: qk.groups.joinRequests(id) });
        },
        onError: (err) => {
            toastError(err, 'Could not send request');
        },
    });

    const onRefresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: qk.groups.detail(id) }),
            queryClient.invalidateQueries({ queryKey: qk.bounties.listGroup([id], 'open') }),
            queryClient.invalidateQueries({ queryKey: qk.groups.members(id) }),
            queryClient.invalidateQueries({ queryKey: qk.groups.joinRequests(id) }),
            user
                ? queryClient.invalidateQueries({
                      queryKey: qk.groups.myJoinRequest(id, user.id),
                  })
                : Promise.resolve(),
        ]);
    };

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
                    <ThemedText
                        type="h3"
                        style={{ color: theme[950], textAlign: 'center' }}
                    >
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

    const tabs = isMember ? (['Bounties', 'Members'] as const) : (['Members'] as const);
    const activeTabLabel = tab === 'bounties' ? 'Bounties' : 'Members';
    const pendingRequests = joinRequestsQuery.data ?? [];

    return (
        <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
            <ScreenHeader
                title={group.name}
                actionButton={
                    isAdmin
                        ? {
                              icon: 'pencil',
                              onPress: () => setEditOpen(true),
                              accessibilityLabel: 'Edit group',
                          }
                        : undefined
                }
            />

            <FlatList
                data={tab === 'bounties' ? bountiesQuery.data ?? [] : []}
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
                        {/* Header */}
                        <View
                            style={{
                                paddingHorizontal: 16,
                                paddingTop: 8,
                                paddingBottom: 16,
                                gap: 12,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <GroupLogoDot
                                    name={group.name}
                                    logoUrl={group.logoUrl ?? null}
                                    size={56}
                                />
                                <View style={{ flex: 1, gap: 4 }}>
                                    <ThemedText type="h3" style={{ color: theme[950] }}>
                                        {group.name}
                                    </ThemedText>
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8,
                                        }}
                                    >
                                        <ThemedText
                                            type="caption"
                                            style={{ color: theme[500] }}
                                        >
                                            {group.memberCount}{' '}
                                            {group.memberCount === 1 ? 'member' : 'members'}
                                        </ThemedText>
                                        {isAdmin ? <Pill intent="info" label="ADMIN" icon="shield.fill" /> : null}
                                        {isMember && !isAdmin ? (
                                            <Pill intent="success" label="MEMBER" icon="person.fill" />
                                        ) : null}
                                        {!isMember && hasPendingRequest ? (
                                            <Pill intent="warning" label="REQUESTED" icon="clock.fill" />
                                        ) : null}
                                    </View>
                                </View>
                            </View>

                            {group.description ? (
                                <ThemedText
                                    type="body-sm"
                                    style={{ color: theme[700], lineHeight: 20 }}
                                >
                                    {group.description}
                                </ThemedText>
                            ) : null}

                            {!isMember ? (
                                <Button
                                    title={hasPendingRequest ? 'Request pending' : 'Request to join'}
                                    variant={hasPendingRequest ? 'secondary' : 'primary'}
                                    disabled={hasPendingRequest || requestMutation.isPending}
                                    loading={requestMutation.isPending}
                                    onPress={() => {
                                        haptic('medium');
                                        requestMutation.mutate();
                                    }}
                                />
                            ) : null}
                        </View>

                        {/* Tabs (members tab only for non-members) */}
                        {tabs.length > 1 ? (
                            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                                <SegmentedToggle
                                    tabs={tabs}
                                    activeTab={activeTabLabel as (typeof tabs)[number]}
                                    onTabChange={(t) =>
                                        setTab(t === 'Bounties' ? 'bounties' : 'members')
                                    }
                                    size="md"
                                />
                            </View>
                        ) : null}

                        {/* Members tab body */}
                        {tab === 'members' ? (
                            <View style={{ paddingTop: 8 }}>
                                {isAdmin ? (
                                    <View style={{ paddingBottom: 8 }}>
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
                                            <View style={{ paddingHorizontal: 16, gap: 12 }}>
                                                <Skeleton height={56} />
                                            </View>
                                        ) : pendingRequests.length === 0 ? (
                                            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
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
                                        <View
                                            style={{
                                                paddingHorizontal: 16,
                                                paddingTop: 16,
                                                paddingBottom: 8,
                                            }}
                                        >
                                            <SectionLabel label="Members" />
                                        </View>
                                    </View>
                                ) : null}

                                {membersQuery.isLoading ? (
                                    <View style={{ paddingHorizontal: 16, gap: 12 }}>
                                        {[0, 1, 2].map((k) => (
                                            <Skeleton key={k} height={56} />
                                        ))}
                                    </View>
                                ) : membersQuery.isError ? (
                                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                                        <ThemedText
                                            type="body-sm"
                                            style={{ color: theme[500] }}
                                        >
                                            Couldn&apos;t load members. Pull to retry.
                                        </ThemedText>
                                        {__DEV__ ? (
                                            <ThemedText
                                                type="caption"
                                                style={{ color: theme[400], marginTop: 4 }}
                                            >
                                                {membersQuery.error instanceof Error
                                                    ? membersQuery.error.message
                                                    : String(membersQuery.error)}
                                            </ThemedText>
                                        ) : null}
                                    </View>
                                ) : (membersQuery.data ?? []).length === 0 ? (
                                    <EmptyState
                                        title={EMPTY_GROUP_MEMBERS.title}
                                        description={EMPTY_GROUP_MEMBERS.description}
                                    />
                                ) : (
                                    (membersQuery.data ?? []).map((m) => (
                                        <MemberRow
                                            key={m.id}
                                            member={m}
                                            group={group}
                                            members={membersQuery.data ?? []}
                                            viewerIsAdmin={isAdmin}
                                            viewerUid={user?.id ?? null}
                                        />
                                    ))
                                )}
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
                                            borderBottomWidth: 1,
                                            borderBottomColor: theme[100],
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
                                            <Icon name="plus" size={16} color={theme[700]} />
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
                        ) : null}
                    </View>
                }
                ListEmptyComponent={
                    tab === 'bounties' && !bountiesQuery.isLoading ? (
                        <EmptyState
                            title={EMPTY_GROUP_BOUNTIES.title}
                            description={EMPTY_GROUP_BOUNTIES.description}
                        />
                    ) : null
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
        </ThemedView>
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
    const canRemove = viewerIsAdmin && !cannotRemoveLastAdmin;

    const removeMutation = useMutation({
        mutationFn: () => removeGroupMember({ groupId: group.id, uid: member.uid }),
        onSuccess: () => {
            haptic('heavy');
            toast.success(`${display} removed`);
            queryClient.invalidateQueries({ queryKey: qk.groups.members(group.id) });
            queryClient.invalidateQueries({ queryKey: qk.groups.detail(group.id) });
            queryClient.invalidateQueries({ queryKey: ['groups', 'myMemberships'] });
        },
        onError: (err) => {
            toastError(err, 'Could not remove');
        },
    });

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
            {member.role === 'admin' ? <Pill intent="info" label="ADMIN" icon="shield.fill" /> : null}
            {canRemove ? (
                <PopoverMenu
                    items={[
                        {
                            label: isSelf ? 'Leave group' : 'Remove from group',
                            destructive: true,
                            onPress: () => setConfirmOpen(true),
                        },
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

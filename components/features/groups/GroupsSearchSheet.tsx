import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import TextInput from '@/components/ui/TextInput';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import {
    listMyMemberships,
    requestJoinGroup,
    searchGroups,
} from '@/lib/services/groupService';
import { qk } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import type { Group } from '@/lib/types/group';

interface GroupsSearchSheetProps {
    visible: boolean;
    onClose: () => void;
}

export function GroupsSearchSheet({ visible, onClose }: GroupsSearchSheetProps) {
    const { theme } = useTheme();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [queryText, setQueryText] = useState('');
    const debounced = useDebounce(queryText, 250);

    const groupsQuery = useQuery({
        queryKey: qk.groups.search(debounced.trim().toLowerCase()),
        queryFn: () => searchGroups(debounced),
        enabled: visible,
        staleTime: 60_000,
    });

    const membershipsQuery = useQuery({
        queryKey: user ? qk.groups.myMemberships(user.id) : ['groups', 'myMemberships', 'anon'],
        queryFn: () => (user ? listMyMemberships(user.id) : Promise.resolve([])),
        enabled: !!user && visible,
        staleTime: 60_000,
    });

    const joinedIds = useMemo(
        () => new Set((membershipsQuery.data ?? []).map((m) => m.groupId)),
        [membershipsQuery.data],
    );

    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

    const joinMutation = useMutation({
        mutationFn: (groupId: string) => requestJoinGroup(groupId),
        onMutate: (groupId) => {
            setPendingIds((prev) => new Set(prev).add(groupId));
        },
        onSuccess: () => {
            haptic('medium');
            toast.success('Join request sent');
        },
        onError: (err) => {
            haptic('error');
            toast.error(err instanceof Error ? err.message : 'Could not request join');
        },
        onSettled: (_d, _e, groupId) => {
            setPendingIds((prev) => {
                const next = new Set(prev);
                next.delete(groupId);
                return next;
            });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
    });

    const data = groupsQuery.data ?? [];

    return (
        <BottomSheet visible={visible} onClose={onClose} title="Groups" height={620} keyboardAware>
            {() => (
                <View style={{ flex: 1, paddingTop: 8 }}>
                    <View style={{ paddingBottom: 12 }}>
                        <TextInput
                            value={queryText}
                            onChangeText={setQueryText}
                            placeholder="Search groups"
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="search"
                            leftIcon={
                                <Icon name="magnifyingglass" size={18} color={theme[400]} />
                            }
                        />
                    </View>

                    {groupsQuery.isLoading ? (
                        <View style={{ gap: 12 }}>
                            {[0, 1, 2, 3].map((k) => (
                                <Skeleton key={k} height={64} />
                            ))}
                        </View>
                    ) : (
                        <FlatList
                            data={data}
                            keyExtractor={(g) => g.id}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 24 }}
                            renderItem={({ item }) => (
                                <GroupRow
                                    group={item}
                                    joined={joinedIds.has(item.id)}
                                    pending={pendingIds.has(item.id)}
                                    onJoin={() => joinMutation.mutate(item.id)}
                                />
                            )}
                            ListEmptyComponent={
                                <EmptyState
                                    title={debounced.trim() ? 'No matches' : 'No groups yet'}
                                    description={
                                        debounced.trim()
                                            ? 'Try a different search.'
                                            : 'Check back soon — new groups land here as they go live.'
                                    }
                                />
                            }
                        />
                    )}
                </View>
            )}
        </BottomSheet>
    );
}

function GroupRow({
    group,
    joined,
    pending,
    onJoin,
}: {
    group: Group;
    joined: boolean;
    pending: boolean;
    onJoin: () => void;
}) {
    const { theme } = useTheme();
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: theme[100],
                gap: 12,
            }}
        >
            <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="body-md-semibold" style={{ color: theme[950] }} numberOfLines={1}>
                    {group.name}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme[500] }}>
                    {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                </ThemedText>
            </View>
            {joined ? (
                <Pill intent="success" label="JOINED" />
            ) : (
                <Pressable
                    onPress={onJoin}
                    disabled={pending}
                    style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: theme[950],
                        opacity: pending ? 0.6 : 1,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Request to join ${group.name}`}
                >
                    <ThemedText type="caption-semibold" style={{ color: theme[50] }}>
                        {pending ? 'Sending…' : 'Request join'}
                    </ThemedText>
                </Pressable>
            )}
        </View>
    );
}

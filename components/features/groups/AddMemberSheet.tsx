import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import TextInput from '@/components/ui/TextInput';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { SubmitButton, type SubmitButtonState } from '@/components/ui/SubmitButton';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { addGroupMember, listGroupMembers } from '@/lib/services/groupService';
import { searchProfilesByUsername } from '@/lib/services/profileService';
import { qk } from '@/lib/constants/queryKeys';
import { toast, toastError } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import type { Profile } from '@/lib/types/profile';

interface AddMemberSheetProps {
    visible: boolean;
    onClose: () => void;
    groupId: string;
}

export function AddMemberSheet({ visible, onClose, groupId }: AddMemberSheetProps) {
    const { theme } = useTheme();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [queryText, setQueryText] = useState('');
    const [selected, setSelected] = useState<Profile | null>(null);
    const debounced = useDebounce(queryText, 250);
    const needle = debounced.trim().toLowerCase().replace(/^@/, '');

    useEffect(() => {
        // Reset selection any time the typed query changes — picks must
        // be deliberate against the *current* result set.
        setSelected(null);
    }, [needle]);

    const searchQuery = useQuery({
        queryKey: qk.profiles.search(needle),
        queryFn: () => searchProfilesByUsername(needle),
        enabled: visible && needle.length > 0,
        staleTime: 30_000,
    });

    const membersQuery = useQuery({
        queryKey: qk.groups.members(groupId),
        queryFn: () => listGroupMembers(groupId),
        enabled: visible,
        staleTime: 60_000,
    });

    const memberIds = useMemo(
        () => new Set((membersQuery.data ?? []).map((m) => m.uid)),
        [membersQuery.data],
    );

    const results = useMemo(() => {
        const all = searchQuery.data ?? [];
        return all.filter((p) => p.id !== user?.id);
    }, [searchQuery.data, user?.id]);

    const addMutation = useMutation({
        mutationFn: async (profile: Profile) =>
            addGroupMember({ groupId, identifier: profile.username }),
        onSuccess: (res) => {
            haptic('heavy');
            toast.success(`${res.displayName} added`);
            setQueryText('');
            setSelected(null);
            queryClient.invalidateQueries({ queryKey: qk.groups.members(groupId) });
            queryClient.invalidateQueries({ queryKey: qk.groups.detail(groupId) });
            queryClient.invalidateQueries({ queryKey: ['groups', 'myMemberships'] });
            onClose();
        },
        onError: (err) => {
            toastError(err, 'Could not add');
        },
    });

    const selectedIsMember = selected ? memberIds.has(selected.id) : false;
    const searchSettled = visible && needle.length > 0 && !searchQuery.isLoading;
    const hasNoMatches = searchSettled && results.length === 0;

    let buttonState: SubmitButtonState = 'idle';
    let buttonLabel = 'Pick someone';
    let canSubmit = false;
    if (needle.length === 0) {
        buttonLabel = 'Pick someone';
    } else if (searchQuery.isLoading) {
        buttonLabel = 'Searching…';
    } else if (hasNoMatches) {
        buttonState = 'error';
        buttonLabel = `No user @${needle}`;
    } else if (selected) {
        if (selectedIsMember) {
            buttonState = 'error';
            buttonLabel = `@${selected.username} is already in`;
        } else {
            buttonLabel = `Add @${selected.username}`;
            canSubmit = true;
        }
    } else {
        buttonLabel = 'Pick a result below';
    }

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            title="Add member"
            height={620}
            keyboardAware
        >
            {() => (
                <View style={{ flex: 1, paddingTop: 8 }}>
                    <View style={{ paddingBottom: 12 }}>
                        <TextInput
                            value={queryText}
                            onChangeText={setQueryText}
                            placeholder="Search by username"
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="search"
                            leftIcon={
                                <Icon name="magnifyingglass" size={18} color={theme[400]} />
                            }
                        />
                    </View>

                    <View style={{ flex: 1 }}>
                        {needle.length === 0 ? (
                            <EmptyState
                                title="Find someone"
                                description="Start typing a username to search."
                            />
                        ) : searchQuery.isLoading ? (
                            <View style={{ gap: 12 }}>
                                {[0, 1, 2].map((k) => (
                                    <Skeleton key={k} height={56} />
                                ))}
                            </View>
                        ) : (
                            <FlatList
                                data={results}
                                keyExtractor={(p) => p.id}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={{ paddingBottom: 16 }}
                                renderItem={({ item }) => (
                                    <ProfileRow
                                        profile={item}
                                        joined={memberIds.has(item.id)}
                                        selected={selected?.id === item.id}
                                        onSelect={() => setSelected(item)}
                                    />
                                )}
                                ListEmptyComponent={
                                    <EmptyState
                                        title="No matches"
                                        description={`No user with username starting with “${needle}”.`}
                                    />
                                }
                            />
                        )}
                    </View>

                    <View style={{ paddingTop: 12 }}>
                        <SubmitButton
                            idleLabel={buttonLabel}
                            errorLabel={buttonLabel}
                            loadingLabel="Adding…"
                            state={buttonState}
                            disabled={!canSubmit}
                            loading={addMutation.isPending}
                            onPress={() => selected && addMutation.mutate(selected)}
                        />
                    </View>
                </View>
            )}
        </BottomSheet>
    );
}

function ProfileRow({
    profile,
    joined,
    selected,
    onSelect,
}: {
    profile: Profile;
    joined: boolean;
    selected: boolean;
    onSelect: () => void;
}) {
    const { theme } = useTheme();
    const borderColor = selected ? theme[950] : theme[100];
    return (
        <Pressable
            onPress={joined ? undefined : onSelect}
            disabled={joined}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: selected ? 12 : 0,
                borderRadius: selected ? 12 : 0,
                borderBottomWidth: selected ? 0 : 1,
                borderWidth: selected ? 1 : 0,
                borderColor,
                borderBottomColor: theme[100],
                gap: 12,
                opacity: joined ? 0.55 : 1,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Select ${profile.username}`}
        >
            <Avatar
                avatarUrl={profile.avatarUrl}
                size="md"
                initial={(profile.displayName || profile.username || '?').charAt(0)}
            />
            <View style={{ flex: 1, gap: 2 }}>
                <ThemedText
                    type="body-md-semibold"
                    style={{ color: theme[950] }}
                    numberOfLines={1}
                >
                    {profile.displayName || profile.username}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme[500] }} numberOfLines={1}>
                    @{profile.username}
                </ThemedText>
            </View>
            {joined ? (
                <ThemedText
                    type="caption-semibold"
                    style={{ color: theme[400], letterSpacing: 0.6 }}
                >
                    IN GROUP
                </ThemedText>
            ) : selected ? (
                <Icon name="checkmark.circle.fill" size={20} color={theme[950]} />
            ) : null}
        </Pressable>
    );
}


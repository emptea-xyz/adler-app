import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon } from '@/components/ui/Icon';
import { SectionLabel } from '@/components/base/SectionLabel';
import { SolanaIcon } from '@/components/ui/SolanaIcon';
import { GroupLogoDot } from '@/components/features/bounty/BountyTags';
import { useTheme } from '@/contexts/ThemeContext';
import { updateGroup } from '@/lib/services/groupService';
import { listGroupBounties } from '@/lib/services/bountyService';
import { uploadGroupLogo } from '@/lib/services/groupMediaUploadService';
import { pickImage } from '@/lib/services/imageUploadService';
import { qk } from '@/lib/constants/queryKeys';
import { toast, toastError } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { formatSol } from '@/lib/utils/formatNumber';
import { TailwindColors } from '@/constants/TailwindColors';
import type { Group } from '@/lib/types/group';
import type { Bounty } from '@/lib/types/bounty';

interface GroupEditSheetProps {
    visible: boolean;
    onClose: () => void;
    group: Group;
}

const MIN_NAME = 3;
const MAX_NAME = 40;
const MAX_DESCRIPTION = 500;
const MAX_RULES = 1000;

export function GroupEditSheet({ visible, onClose, group }: GroupEditSheetProps) {
    const { theme } = useTheme();
    const queryClient = useQueryClient();
    const [name, setName] = useState(group.name);
    const [description, setDescription] = useState(group.description);
    const [rules, setRules] = useState(group.rules);
    const [logoUrl, setLogoUrl] = useState<string | null>(group.logoUrl ?? null);
    const [pinnedBountyId, setPinnedBountyId] = useState<string | null>(
        group.pinnedBountyId,
    );
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        if (visible) {
            setName(group.name);
            setDescription(group.description);
            setRules(group.rules);
            setLogoUrl(group.logoUrl ?? null);
            setPinnedBountyId(group.pinnedBountyId);
            setPickerOpen(false);
        }
    }, [visible, group.name, group.description, group.rules, group.logoUrl, group.pinnedBountyId]);

    const bountiesQuery = useQuery({
        queryKey: qk.bounties.listGroup([group.id], 'open'),
        queryFn: () => listGroupBounties([group.id]),
        enabled: visible,
        staleTime: 30_000,
    });
    const openBounties = bountiesQuery.data ?? [];
    const pinnedBounty = useMemo(
        () => openBounties.find((b) => b.id === pinnedBountyId) ?? null,
        [openBounties, pinnedBountyId],
    );

    const logoMutation = useMutation({
        mutationFn: async () => {
            const localUri = await pickImage({ aspect: [1, 1], quality: 0.85 });
            if (!localUri) return null;
            const url = await uploadGroupLogo(group.id, localUri);
            await updateGroup({ groupId: group.id, logoUrl: url });
            return url;
        },
        onSuccess: (url) => {
            if (!url) return;
            setLogoUrl(url);
            haptic('heavy');
            toast.success('Avatar updated');
            queryClient.invalidateQueries({ queryKey: qk.groups.detail(group.id) });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
        onError: (err) => {
            toastError(err, 'Upload failed');
        },
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            const trimmedName = name.trim();
            const trimmedDescription = description.trim();
            const trimmedRules = rules.trim();
            const payload: {
                groupId: string;
                name?: string;
                description?: string;
                rules?: string;
                pinnedBountyId?: string | null;
            } = { groupId: group.id };
            if (trimmedName !== group.name) payload.name = trimmedName;
            if (trimmedDescription !== group.description) payload.description = trimmedDescription;
            if (trimmedRules !== group.rules) payload.rules = trimmedRules;
            if (pinnedBountyId !== group.pinnedBountyId) {
                payload.pinnedBountyId = pinnedBountyId;
            }
            if (
                payload.name === undefined &&
                payload.description === undefined &&
                payload.rules === undefined &&
                payload.pinnedBountyId === undefined
            ) {
                return;
            }
            await updateGroup(payload);
        },
        onSuccess: () => {
            haptic('heavy');
            toast.success('Saved');
            queryClient.invalidateQueries({ queryKey: qk.groups.detail(group.id) });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            onClose();
        },
        onError: (err) => {
            toastError(err, 'Could not save');
        },
    });

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const trimmedRules = rules.trim();
    const nameValid = trimmedName.length >= MIN_NAME && trimmedName.length <= MAX_NAME;
    const descriptionValid = trimmedDescription.length <= MAX_DESCRIPTION;
    const rulesValid = trimmedRules.length <= MAX_RULES;
    const dirty =
        trimmedName !== group.name ||
        trimmedDescription !== group.description ||
        trimmedRules !== group.rules ||
        pinnedBountyId !== group.pinnedBountyId;
    const canSubmit = nameValid && descriptionValid && rulesValid && dirty && !saveMutation.isPending;

    const selectBounty = (id: string | null) => {
        haptic('light');
        setPinnedBountyId(id);
        setPickerOpen(false);
    };

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            title="Edit group"
            height={720}
            keyboardAware
        >
            {() => (
                <View style={{ flex: 1 }}>
                    <ScrollView
                        contentContainerStyle={{ paddingTop: 8, paddingBottom: 16, gap: 20 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Avatar */}
                        <View style={{ alignItems: 'center', gap: 8 }}>
                            <Pressable
                                onPress={() => {
                                    if (logoMutation.isPending) return;
                                    haptic('light');
                                    logoMutation.mutate();
                                }}
                                disabled={logoMutation.isPending}
                                accessibilityRole="button"
                                accessibilityLabel="Change group avatar"
                                style={{ position: 'relative' }}
                            >
                                <GroupLogoDot name={name || group.name} logoUrl={logoUrl} size={80} />
                                <View
                                    style={{
                                        position: 'absolute',
                                        bottom: -2,
                                        right: -2,
                                        width: 28,
                                        height: 28,
                                        borderRadius: 14,
                                        backgroundColor: theme[950],
                                        borderWidth: 2,
                                        borderColor: theme[50],
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {logoMutation.isPending ? (
                                        <ActivityIndicator size="small" color={theme[50]} />
                                    ) : (
                                        <Icon name="camera.fill" size={14} color={theme[50]} />
                                    )}
                                </View>
                            </Pressable>
                            <ThemedText type="caption" style={{ color: theme[500] }}>
                                {logoMutation.isPending ? 'Uploading…' : 'Tap to change avatar'}
                            </ThemedText>
                        </View>

                        <View style={{ gap: 6 }}>
                            <SectionLabel label="Name" />
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="Group name"
                                maxLength={MAX_NAME}
                                autoCapitalize="words"
                                returnKeyType="next"
                                style={{ height: 48 }}
                            />
                            <ThemedText type="caption" style={{ color: theme[400] }}>
                                {trimmedName.length}/{MAX_NAME} · min {MIN_NAME}
                            </ThemedText>
                        </View>

                        <View style={{ gap: 6 }}>
                            <SectionLabel label="Description" />
                            <TextInput
                                value={description}
                                onChangeText={setDescription}
                                placeholder="What is this group for?"
                                multiline
                                maxLength={MAX_DESCRIPTION}
                                style={{ height: 96, textAlignVertical: 'top' }}
                            />
                            <ThemedText type="caption" style={{ color: theme[400] }}>
                                {trimmedDescription.length}/{MAX_DESCRIPTION}
                            </ThemedText>
                        </View>

                        <View style={{ gap: 6 }}>
                            <SectionLabel label="Rules" />
                            <TextInput
                                value={rules}
                                onChangeText={setRules}
                                placeholder="House rules, submission requirements, vibe — anything members should know."
                                multiline
                                maxLength={MAX_RULES}
                                style={{ height: 120, textAlignVertical: 'top' }}
                            />
                            <ThemedText type="caption" style={{ color: theme[400] }}>
                                {trimmedRules.length}/{MAX_RULES}
                            </ThemedText>
                        </View>

                        <View style={{ gap: 8 }}>
                            <SectionLabel label="Pinned bounty" />
                            <Pressable
                                onPress={() => {
                                    haptic('light');
                                    setPickerOpen((v) => !v);
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: theme[200],
                                    backgroundColor: theme[50],
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Choose pinned bounty"
                            >
                                <Icon
                                    name="pin.fill"
                                    size={16}
                                    color={pinnedBounty ? theme[950] : theme[400]}
                                />
                                <View style={{ flex: 1 }}>
                                    <ThemedText
                                        type="body-md-semibold"
                                        style={{ color: pinnedBounty ? theme[950] : theme[500] }}
                                        numberOfLines={1}
                                    >
                                        {pinnedBounty?.title ?? 'None pinned'}
                                    </ThemedText>
                                    {pinnedBounty ? (
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 4,
                                                marginTop: 2,
                                            }}
                                        >
                                            <ThemedText
                                                type="caption-semibold"
                                                style={{
                                                    color: TailwindColors.sky[500],
                                                    letterSpacing: -0.2,
                                                }}
                                            >
                                                {formatSol(pinnedBounty.bountyLamports / 1e9)}
                                            </ThemedText>
                                            <SolanaIcon size={10} color={TailwindColors.sky[500]} />
                                        </View>
                                    ) : null}
                                </View>
                                <Icon
                                    name={pickerOpen ? 'chevron.up' : 'chevron.down'}
                                    size={16}
                                    color={theme[500]}
                                />
                            </Pressable>

                            {pickerOpen ? (
                                <View
                                    style={{
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: theme[200],
                                        overflow: 'hidden',
                                    }}
                                >
                                    {bountiesQuery.isLoading ? (
                                        <View style={{ padding: 16, alignItems: 'center' }}>
                                            <ActivityIndicator size="small" color={theme[500]} />
                                        </View>
                                    ) : openBounties.length === 0 ? (
                                        <View style={{ padding: 16 }}>
                                            <ThemedText
                                                type="caption"
                                                style={{ color: theme[500] }}
                                            >
                                                No open bounties in this group yet.
                                            </ThemedText>
                                        </View>
                                    ) : (
                                        <View>
                                            {pinnedBountyId ? (
                                                <PickerRow
                                                    title="Clear pin"
                                                    subtitle="Show the regular list"
                                                    onPress={() => selectBounty(null)}
                                                    destructive
                                                />
                                            ) : null}
                                            {openBounties.map((b) => (
                                                <PickerRow
                                                    key={b.id}
                                                    title={b.title}
                                                    subtitle={`${formatSol(b.bountyLamports / 1e9)} SOL`}
                                                    selected={b.id === pinnedBountyId}
                                                    onPress={() => selectBounty(b.id)}
                                                />
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ) : null}
                        </View>
                    </ScrollView>

                    <View style={{ paddingTop: 12 }}>
                        <Button
                            title={saveMutation.isPending ? 'Saving…' : 'Save'}
                            onPress={() => saveMutation.mutate()}
                            disabled={!canSubmit}
                            loading={saveMutation.isPending}
                            size="lg"
                        />
                    </View>
                </View>
            )}
        </BottomSheet>
    );
}

function PickerRow({
    title,
    subtitle,
    selected,
    destructive,
    onPress,
}: {
    title: string;
    subtitle?: string;
    selected?: boolean;
    destructive?: boolean;
    onPress: () => void;
}) {
    const { theme } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                opacity: pressed ? 0.85 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: theme[100],
            })}
            accessibilityRole="button"
            accessibilityLabel={title}
        >
            <View style={{ flex: 1, gap: 2 }}>
                <ThemedText
                    type="body-md-semibold"
                    style={{
                        color: destructive ? '#DC143C' : theme[950],
                    }}
                    numberOfLines={1}
                >
                    {title}
                </ThemedText>
                {subtitle ? (
                    <ThemedText type="caption" style={{ color: theme[500] }}>
                        {subtitle}
                    </ThemedText>
                ) : null}
            </View>
            {selected ? (
                <Icon name="checkmark.circle.fill" size={20} color={theme[950]} />
            ) : null}
        </Pressable>
    );
}

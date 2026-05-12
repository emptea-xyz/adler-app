import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon } from '@/components/ui/Icon';
import { GroupLogoDot } from '@/components/features/bounty/BountyTags';
import { useTheme } from '@/contexts/ThemeContext';
import { updateGroup } from '@/lib/services/groupService';
import { uploadGroupLogo } from '@/lib/services/groupMediaUploadService';
import { pickImage } from '@/lib/services/imageUploadService';
import { qk } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import type { Group } from '@/lib/types/group';

interface GroupEditSheetProps {
    visible: boolean;
    onClose: () => void;
    group: Group;
}

const MIN_NAME = 3;
const MAX_NAME = 40;
const MAX_DESCRIPTION = 500;

export function GroupEditSheet({ visible, onClose, group }: GroupEditSheetProps) {
    const { theme } = useTheme();
    const queryClient = useQueryClient();
    const [name, setName] = useState(group.name);
    const [description, setDescription] = useState(group.description);
    // Local preview URL (download URL from Storage). Auto-committed via the
    // logoMutation as soon as upload succeeds; the next Save click won't
    // include it again.
    const [logoUrl, setLogoUrl] = useState<string | null>(group.logoUrl ?? null);

    // Reset draft when the sheet (re-)opens for a (possibly different) group.
    useEffect(() => {
        if (visible) {
            setName(group.name);
            setDescription(group.description);
            setLogoUrl(group.logoUrl ?? null);
        }
    }, [visible, group.name, group.description, group.logoUrl]);

    const logoMutation = useMutation({
        mutationFn: async () => {
            const localUri = await pickImage({ aspect: [1, 1], quality: 0.85 });
            if (!localUri) return null;
            const url = await uploadGroupLogo(group.id, localUri);
            await updateGroup({ groupId: group.id, logoUrl: url });
            return url;
        },
        onSuccess: (url) => {
            if (!url) return; // user cancelled the picker
            setLogoUrl(url);
            haptic('heavy');
            toast.success('Avatar updated');
            queryClient.invalidateQueries({ queryKey: qk.groups.detail(group.id) });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
        onError: (err) => {
            haptic('error');
            toast.error(err instanceof Error ? err.message : 'Upload failed');
        },
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            const trimmedName = name.trim();
            const trimmedDescription = description.trim();
            const payload: { groupId: string; name?: string; description?: string } = {
                groupId: group.id,
            };
            if (trimmedName !== group.name) payload.name = trimmedName;
            if (trimmedDescription !== group.description) payload.description = trimmedDescription;
            if (payload.name === undefined && payload.description === undefined) return;
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
            haptic('error');
            toast.error(err instanceof Error ? err.message : 'Could not save');
        },
    });

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const nameValid = trimmedName.length >= MIN_NAME && trimmedName.length <= MAX_NAME;
    const descriptionValid = trimmedDescription.length <= MAX_DESCRIPTION;
    const dirty = trimmedName !== group.name || trimmedDescription !== group.description;
    const canSubmit = nameValid && descriptionValid && dirty && !saveMutation.isPending;

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            title="Edit group"
            height={560}
            keyboardAware
        >
            {() => (
                <View style={{ flex: 1, paddingTop: 8, gap: 16 }}>
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
                        <ThemedText
                            type="caption-semibold"
                            style={{ color: theme[500], letterSpacing: 0.6 }}
                        >
                            NAME
                        </ThemedText>
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
                        <ThemedText
                            type="caption-semibold"
                            style={{ color: theme[500], letterSpacing: 0.6 }}
                        >
                            DESCRIPTION
                        </ThemedText>
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

                    <View style={{ marginTop: 'auto' }}>
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

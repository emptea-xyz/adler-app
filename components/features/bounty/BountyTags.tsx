import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { TailwindColors } from '@/constants/TailwindColors';
import { Neutral } from '@/constants/NeutralColors';
import { qk } from '@/lib/constants/queryKeys';
import { getGroup } from '@/lib/services/groupService';
import type { Bounty } from '@/lib/types/bounty';

/**
 * Icon-first metadata row for a bounty. Each chip is a color-filled
 * circle with a white SF Symbol inside; tap → BottomSheet explanation.
 *
 * Color code is consistent across the app:
 *   - emerald  → photo / captured visual
 *   - indigo   → video
 *   - violet   → link / web reference
 *   - slate    → broad reach / public / group
 */

const TAG_CIRCLE_SIZE = 28;
const TAG_ICON_SIZE = 16;

type TagId = 'kind' | 'scope';

interface TagDescriptor {
    id: TagId;
    icon: IconName;
    bgColor: string;
    title: string;
    description: string;
    /** When set, replaces the chip with the group's avatar (logo or initial). */
    groupAvatar?: { name: string; logoUrl: string | null };
}

function kindTag(b: Bounty): TagDescriptor {
    if (b.submissionKind === 'link') {
        return {
            id: 'kind',
            icon: 'link',
            bgColor: TailwindColors.violet[500],
            title: 'Link submission',
            description: 'Submitters reply with a URL — e.g. a GitHub repo or live page.',
        };
    }
    if (b.submissionKind === 'video') {
        return {
            id: 'kind',
            icon: 'video.fill',
            bgColor: TailwindColors.indigo[500],
            title: 'Video submission',
            description: 'Submitters upload a video that matches the brief.',
        };
    }
    return {
        id: 'kind',
        icon: 'camera.fill',
        bgColor: TailwindColors.emerald[500],
        title: 'Photo submission',
        description: 'Submitters upload a photo that matches the brief.',
    };
}

export function BountyTags({ bounty }: { bounty: Bounty }) {
    const [openTag, setOpenTag] = useState<TagDescriptor | null>(null);

    const groupQuery = useQuery({
        queryKey: bounty.groupId ? qk.groups.detail(bounty.groupId) : ['groups', 'detail', 'none'],
        queryFn: () => (bounty.groupId ? getGroup(bounty.groupId) : Promise.resolve(null)),
        enabled: !!bounty.groupId,
        staleTime: 60_000,
    });
    const group = groupQuery.data ?? null;

    const tags: TagDescriptor[] = [
        kindTag(bounty),
        bounty.scope === 'group'
            ? {
                  id: 'scope',
                  icon: 'person.2.fill',
                  bgColor: TailwindColors.slate[500],
                  title: group ? group.name : 'Group bounty',
                  description: group
                      ? `Only members of ${group.name} can submit.${group.description ? ' ' + group.description : ''}`
                      : 'Only group members can submit.',
                  groupAvatar: group
                      ? { name: group.name, logoUrl: group.logoUrl ?? null }
                      : undefined,
              }
            : {
                  id: 'scope',
                  icon: 'globe',
                  bgColor: TailwindColors.slate[500],
                  title: 'Public',
                  description: 'Anyone with the app can submit.',
              },
    ];

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {tags.map((tag) => (
                <Pressable
                    key={tag.id}
                    onPress={() => {
                        haptic('light');
                        setOpenTag(tag);
                    }}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`${tag.title} — tap to explain`}
                >
                    {tag.groupAvatar ? (
                        <GroupLogoDot
                            name={tag.groupAvatar.name}
                            logoUrl={tag.groupAvatar.logoUrl}
                            size={TAG_CIRCLE_SIZE}
                        />
                    ) : (
                        <TagChip icon={tag.icon} bgColor={tag.bgColor} />
                    )}
                </Pressable>
            ))}

            <BountyTagSheet tag={openTag} onClose={() => setOpenTag(null)} />
        </View>
    );
}

function TagChip({ icon, bgColor }: { icon: IconName; bgColor: string }) {
    return (
        <View
            style={{
                width: TAG_CIRCLE_SIZE,
                height: TAG_CIRCLE_SIZE,
                borderRadius: TAG_CIRCLE_SIZE / 2,
                backgroundColor: bgColor,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Icon name={icon} size={TAG_ICON_SIZE} color={Neutral.white} weight="semibold" />
        </View>
    );
}

export function GroupLogoDot({
    name,
    logoUrl,
    size = 16,
}: {
    name: string;
    logoUrl: string | null;
    size?: number;
}) {
    const { theme } = useTheme();
    if (logoUrl) {
        return (
            <Image
                source={{ uri: logoUrl }}
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: theme[100],
                }}
            />
        );
    }
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: theme[200],
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <ThemedText
                type="caption-semibold"
                style={{
                    color: theme[700],
                    fontSize: Math.round(size * 0.55),
                    lineHeight: size,
                }}
            >
                {(name.charAt(0) || '?').toUpperCase()}
            </ThemedText>
        </View>
    );
}

function BountyTagSheet({ tag, onClose }: { tag: TagDescriptor | null; onClose: () => void }) {
    const { theme } = useTheme();
    return (
        <BottomSheet visible={!!tag} onClose={onClose} title={tag?.title ?? ''} height={300}>
            {() => (
                <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 16 }}>
                    {tag ? (
                        tag.groupAvatar ? (
                            <GroupLogoDot
                                name={tag.groupAvatar.name}
                                logoUrl={tag.groupAvatar.logoUrl}
                                size={56}
                            />
                        ) : (
                            <View
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 28,
                                    backgroundColor: tag.bgColor,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Icon
                                    name={tag.icon}
                                    size={28}
                                    color={Neutral.white}
                                    weight="semibold"
                                />
                            </View>
                        )
                    ) : null}
                    <ThemedText type="body-md" style={{ color: theme[700], lineHeight: 22 }}>
                        {tag?.description ?? ''}
                    </ThemedText>
                </View>
            )}
        </BottomSheet>
    );
}

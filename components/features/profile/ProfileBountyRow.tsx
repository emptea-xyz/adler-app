import React from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/base/ThemedText';
import Card from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { formatSol } from '@/lib/utils/formatNumber';
import { Status } from '@/constants/StatusColors';
import type { Bounty } from '@/lib/types/bounty';
import type { Submission } from '@/lib/types/submission';

type Props =
    | { kind: 'created'; bounty: Bounty; onPress: () => void }
    | { kind: 'won'; submission: Submission; bounty?: Bounty; onPress: () => void }
    | { kind: 'participated'; submission: Submission; bounty?: Bounty; onPress: () => void };

interface StatusGlyph {
    name: IconName;
    color: string;
}

export function ProfileBountyRow(props: Props) {
    const { theme } = useTheme();
    const { onPress } = props;

    const prompt =
        props.kind === 'created' ? props.bounty.prompt : (props.bounty?.prompt ?? 'Bounty');
    const lamports =
        props.kind === 'created'
            ? props.bounty.bountyLamports
            : (props.bounty?.bountyLamports ?? 0);

    const glyph = resolveStatus(props, theme[400]);

    return (
        <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Card variant="border-bottom">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1, gap: 8 }}>
                        <ThemedText
                            type="body-md-semibold"
                            style={{ color: theme[950] }}
                            numberOfLines={2}
                        >
                            {prompt}
                        </ThemedText>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Icon name="bookmark.fill" size={12} color={theme[400]} />
                            <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                                {formatSol(lamports / 1e9)} SOL
                            </ThemedText>
                        </View>
                    </View>
                    <View
                        style={{
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            gap: 8,
                        }}
                    >
                        <Icon name="arrow.up.right" size={14} color={theme[400]} />
                        <Icon name={glyph.name} size={16} color={glyph.color} />
                    </View>
                </View>
            </Card>
        </Pressable>
    );
}

function resolveStatus(props: Props, neutral: string): StatusGlyph {
    if (props.kind === 'won') {
        return { name: 'dollarsign.circle.fill', color: Status.success };
    }
    if (props.kind === 'participated') {
        const v = props.submission.aiVerdict;
        if (v === 'fail') return { name: 'xmark.circle.fill', color: Status.error };
        if (v === 'pass') return { name: 'gearshape.2.fill', color: Status.info };
        return { name: 'hourglass', color: Status.warning };
    }
    switch (props.bounty.status) {
        case 'open':
            return { name: 'circle', color: neutral };
        case 'hidden':
            return { name: 'lock.fill', color: neutral };
        case 'settled':
            return { name: 'dollarsign.circle.fill', color: Status.success };
        case 'refunded':
            return { name: 'xmark.circle.fill', color: Status.error };
    }
}

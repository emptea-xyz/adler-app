import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { DESTRUCTIVE } from '@/constants/StatusColors';

export type SettingsRowTrailing = 'chevron' | 'external' | 'none';

export interface SettingsRowSpec {
    icon: IconName;
    title: string;
    onPress: () => void;
    trailing?: SettingsRowTrailing;
    destructive?: boolean;
}

export function SettingsRow({
    spec,
    isLast,
}: {
    spec: SettingsRowSpec;
    isLast: boolean;
}) {
    const { theme } = useTheme();
    const tone = spec.destructive ? DESTRUCTIVE : theme[950];
    const iconTone = spec.destructive ? DESTRUCTIVE : theme[700];
    const trailing = spec.trailing ?? 'chevron';
    return (
        <Pressable
            onPress={spec.onPress}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 56,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: theme[200],
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Icon name={spec.icon} color={iconTone} size={22} />
                    <ThemedText type="body-md-semibold" style={{ color: tone }}>
                        {spec.title}
                    </ThemedText>
                </View>
                {trailing === 'chevron' ? (
                    <Icon name="chevron.right" color={theme[400]} size={18} />
                ) : trailing === 'external' ? (
                    <Icon name="arrow.up.forward.square" color={theme[400]} size={16} />
                ) : null}
            </View>
        </Pressable>
    );
}

export function SettingsGroup({ rows }: { rows: SettingsRowSpec[] }) {
    const { theme } = useTheme();
    return (
        <View
            style={{
                backgroundColor: theme[100],
                borderRadius: 16,
                overflow: 'hidden',
            }}
        >
            {rows.map((row, i) => (
                <SettingsRow key={row.title} spec={row} isLast={i === rows.length - 1} />
            ))}
        </View>
    );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    Switch,
    View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsScreenLayout } from '@/components/base/SettingsScreenLayout';
import { SectionLabel } from '@/components/base/SectionLabel';
import { ThemedText } from '@/components/base/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { qk } from '@/lib/constants/queryKeys';
import {
    getPreferences,
    setNotificationPreference,
} from '@/lib/services/preferencesService';
import type { NotificationKind } from '@/lib/types/notification';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOTIFICATION_KIND_GROUPS,
    type NotificationPreferences,
} from '@/lib/types/preferences';
import { toast } from '@/lib/utils/toast';

export default function SettingsNotificationsScreen() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { theme } = useTheme();
    const [savingKinds, setSavingKinds] = useState<Record<string, boolean>>({});
    const [draft, setDraft] = useState<NotificationPreferences | null>(null);

    const prefsQuery = useQuery({
        queryKey: user ? qk.preferences.detail(user.id) : ['preferences', 'detail', 'anon'],
        enabled: !!user,
        queryFn: () => getPreferences(user!.id),
    });

    useEffect(() => {
        if (!prefsQuery.data) return;
        setDraft({ ...prefsQuery.data.notifications });
    }, [prefsQuery.data]);

    const values = useMemo(
        () => draft ?? { ...DEFAULT_NOTIFICATION_PREFERENCES },
        [draft],
    );

    const onToggle = async (kind: NotificationKind, next: boolean) => {
        if (!user) return;
        const prev = values[kind];
        setDraft((old) => ({ ...(old ?? values), [kind]: next }));
        setSavingKinds((old) => ({ ...old, [kind]: true }));
        try {
            await setNotificationPreference(user.id, kind, next);
            queryClient.invalidateQueries({ queryKey: qk.preferences.detail(user.id) });
        } catch (err: any) {
            setDraft((old) => ({ ...(old ?? values), [kind]: prev }));
            toast.error(err?.message ?? 'Could not update notification preference');
        } finally {
            setSavingKinds((old) => ({ ...old, [kind]: false }));
        }
    };

    return (
        <SettingsScreenLayout
            title="Notifications"
            loading={prefsQuery.isLoading}
            contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 40,
                gap: 20,
            }}
        >
            {NOTIFICATION_KIND_GROUPS.map((group) => (
                <View
                    key={group.label}
                    style={{
                        borderRadius: 12,
                        backgroundColor: theme[100],
                        padding: 16,
                        gap: 12,
                    }}
                >
                    <View style={{ gap: 4 }}>
                        <SectionLabel label={group.label} />
                        <ThemedText type="body-sm" style={{ color: theme[500] }}>
                            {group.description}
                        </ThemedText>
                    </View>
                    {group.kinds.map((row) => {
                        const active = values[row.kind];
                        const saving = !!savingKinds[row.kind];
                        return (
                            <Pressable
                                key={row.kind}
                                onPress={() => onToggle(row.kind, !active)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                }}
                                accessibilityRole="switch"
                                accessibilityState={{ checked: active, disabled: saving }}
                                disabled={saving}
                            >
                                <View style={{ flex: 1, gap: 2 }}>
                                    <ThemedText type="body-sm-semibold">
                                        {row.label}
                                    </ThemedText>
                                    <ThemedText type="caption" style={{ color: theme[500] }}>
                                        {row.description}
                                    </ThemedText>
                                </View>
                                {saving ? (
                                    <ActivityIndicator size="small" color={theme[500]} />
                                ) : (
                                    <Switch
                                        value={active}
                                        onValueChange={(next) => onToggle(row.kind, next)}
                                        trackColor={{ false: theme[300], true: theme[950] }}
                                        thumbColor={theme[50]}
                                    />
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            ))}
        </SettingsScreenLayout>
    );
}

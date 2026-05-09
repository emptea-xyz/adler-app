import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Compass, Bookmark, Inbox, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { SolanaUploadArrow } from '@/components/ui/SolanaUploadArrow';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { useInboxUnread } from '@/hooks/useInboxUnread';
import { Status } from '@/constants/StatusColors';

// Figma node 132:204 — 5 visual slots in the order browse, saved, create,
// inbox, profile. Icons only (no labels). The center "create" slot is a
// pure action button: it opens the CreateSheet via the OverlaySheets
// context and is NOT a navigable route.

const ICONS: Record<string, React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
    browse: Compass,
    saved: Bookmark,
    inbox: Inbox,
    profile: User,
};

const LABELS: Record<string, string> = {
    browse: 'Browse',
    saved: 'Saved',
    inbox: 'Inbox',
    create: 'Create',
    profile: 'Profile',
};

const TAB_ORDER = ['browse', 'saved', 'create', 'inbox', 'profile'] as const;

export function AdlerTabBar({ state, navigation }: BottomTabBarProps) {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { openCreate } = useOverlaySheets();
    const { unread: inboxUnread } = useInboxUnread();

    const onPress = useCallback(
        (routeName: string) => {
            const route = state.routes.find((r) => r.name === routeName);
            if (!route) return;
            const isFocused = state.routes[state.index]?.name === routeName;
            const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
                haptic('light');
                navigation.navigate(route.name, route.params);
            }
        },
        [state, navigation],
    );

    const onCreatePress = useCallback(() => {
        haptic('medium');
        openCreate();
    }, [openCreate]);

    const focusedRouteName = state.routes[state.index]?.name ?? '';

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: theme[50],
                    paddingBottom: insets.bottom,
                    height: TAB_BAR_HEIGHT + insets.bottom,
                },
            ]}
        >
            {TAB_ORDER.map((name) => {
                const isCenter = name === 'create';
                const isFocused = focusedRouteName === name;

                if (isCenter) {
                    return (
                        <Pressable
                            key={name}
                            onPress={onCreatePress}
                            style={styles.centerSlot}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={LABELS[name]}
                        >
                            <SolanaUploadArrow size={52} />
                        </Pressable>
                    );
                }

                const Icon = ICONS[name];
                const showDot = name === 'inbox' && inboxUnread;
                return (
                    <Pressable
                        key={name}
                        onPress={() => onPress(name)}
                        style={styles.tabSlot}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={
                            showDot ? `${LABELS[name]}, new activity` : LABELS[name]
                        }
                    >
                        <View>
                            <Icon
                                size={22}
                                color={isFocused ? theme[950] : theme[400]}
                                strokeWidth={2}
                            />
                            {showDot ? (
                                <View
                                    style={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: Status.error,
                                        borderWidth: 1,
                                        borderColor: theme[50],
                                    }}
                                />
                            ) : null}
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingTop: 8,
        paddingHorizontal: 16,
    },
    tabSlot: {
        flex: 1,
        height: TAB_BAR_HEIGHT - 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerSlot: {
        flex: 1,
        height: TAB_BAR_HEIGHT - 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

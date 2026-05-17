import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Canvas, Rect, LinearGradient, vec } from '@shopify/react-native-skia';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { TailwindColors } from '@/constants/TailwindColors';
import { Status } from '@/constants/StatusColors';
import { qk } from '@/lib/constants/queryKeys';
import { countUnread } from '@/lib/services/notificationsService';

const ICONS: Record<string, IconName> = {
    browse: 'safari.fill',
    inbox: 'tray.fill',
    create: 'plus.circle.fill',
    profile: 'person.fill',
    wallet: 'wallet.bifold.fill',
};

const LABELS: Record<string, string> = {
    browse: 'Browse',
    inbox: 'Inbox',
    create: 'Create',
    profile: 'Profile',
    wallet: 'Wallet',
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { openPostBounty } = useOverlaySheets();
    const { user } = useAuth();

    // Single shared unread counter for the Inbox tab badge. 30s
    // refetchInterval keeps the dot warm without being chatty; the inbox
    // screen also invalidates this key when a notification is read.
    const unreadQuery = useQuery({
        queryKey: user ? [...qk.notifications.list(user.id), 'unread'] : ['notifications', 'unread', 'anon'],
        queryFn: () => (user ? countUnread(user.id) : Promise.resolve(0)),
        enabled: !!user,
        refetchInterval: 30_000,
        staleTime: 15_000,
    });
    const hasUnread = (unreadQuery.data ?? 0) > 0;

    const totalHeight = TAB_BAR_HEIGHT + insets.bottom;

    const onTabPress = useCallback(
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
        openPostBounty();
    }, [openPostBounty]);

    const focusedRouteName = state.routes[state.index]?.name ?? '';

    return (
        <View
            style={[
                styles.container,
                {
                    paddingBottom: insets.bottom,
                    height: totalHeight,

                },
            ]}
            pointerEvents="box-none"
        >
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                <Rect x={0} y={0} width={width} height={totalHeight}>
                    <LinearGradient
                        start={vec(0, 0)}
                        end={vec(0, totalHeight)}
                        colors={[
                            `${theme[50]}00`,
                            `${theme[50]}`,
                            `${theme[50]}`,
                            `${theme[50]}`,
                            theme[50],
                        ]}
                   
                    />
                </Rect>
            </Canvas>
            <Pressable
                key="browse"
                onPress={() => onTabPress('browse')}
                style={styles.tabSlot}
                accessibilityRole="button"
                accessibilityState={focusedRouteName === 'browse' ? { selected: true } : {}}
                accessibilityLabel={LABELS['browse']}
            >
                <Icon
                    name={ICONS['browse']}
                    size={28}
                    color={focusedRouteName === 'browse' ? theme[950] : theme[200]}
                />
            </Pressable>
            <Pressable
                key="inbox"
                onPress={() => onTabPress('inbox')}
                style={styles.tabSlot}
                accessibilityRole="button"
                accessibilityState={focusedRouteName === 'inbox' ? { selected: true } : {}}
                accessibilityLabel={
                    hasUnread ? `${LABELS['inbox']}, new activity` : LABELS['inbox']
                }
            >
                <View>
                    <Icon
                        name={ICONS['inbox']}
                        size={28}
                        color={focusedRouteName === 'inbox' ? theme[950] : theme[200]}
                    />
                    {hasUnread ? (
                        <View
                            style={{
                                position: 'absolute',
                                top: -2,
                                right: -4,
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: Status.error,
                                borderWidth: 1.5,
                                borderColor: theme[50],
                            }}
                        />
                    ) : null}
                </View>
            </Pressable>
            <Pressable
                key="create"
                onPress={onCreatePress}
                style={styles.tabSlot}
                accessibilityRole="button"
                accessibilityState={{}}
                accessibilityLabel={LABELS['create']}
            >
                <Icon
                    name={ICONS['create']}
                    size={28}
                    color={TailwindColors.sky[500]}
                />
            </Pressable>
            <Pressable
                key="wallet"
                onPress={() => onTabPress('wallet')}
                style={styles.tabSlot}
                accessibilityRole="button"
                accessibilityState={focusedRouteName === 'wallet' ? { selected: true } : {}}
                accessibilityLabel={LABELS['wallet']}
            >
                <Icon
                    name={ICONS['wallet']}
                    size={28}
                    color={focusedRouteName === 'wallet' ? theme[950] : theme[200]}
                />
            </Pressable>
            <Pressable
                key="profile"
                onPress={() => onTabPress('profile')}
                style={styles.tabSlot}
                accessibilityRole="button"
                accessibilityState={focusedRouteName === 'profile' ? { selected: true } : {}}
                accessibilityLabel={LABELS['profile']}
            >
                <Icon
                    name={ICONS['profile']}
                    size={28}
                    color={focusedRouteName === 'profile' ? theme[950] : theme[200]}
                />
            </Pressable>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingTop: 18,
        paddingHorizontal: 8,
    },
    tabSlot: {
        flex: 1,
        height: TAB_BAR_HEIGHT - 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';

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

// `create` is a virtual slot — it does not have a Tabs.Screen route. It
// opens the post-bounty bottom sheet directly.
const TAB_ORDER = ['browse', 'inbox', 'create', 'profile', 'wallet'] as const;

export function AdlerTabBar({ state, navigation }: BottomTabBarProps) {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { openPostBounty } = useOverlaySheets();

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
                    backgroundColor: theme[50],
                    paddingBottom: insets.bottom,
                    height: TAB_BAR_HEIGHT + insets.bottom,
                },
            ]}
        >
            {TAB_ORDER.map((name) => {
                const isCreate = name === 'create';
                const isFocused = !isCreate && focusedRouteName === name;
                // `plus.circle.fill` is a solid SF Symbol — tinting it dark
                // gives a filled dark circle with a light plus cutout. Always
                // dark so Create stays the visual anchor regardless of which
                // tab is focused.
                const color = isCreate
                    ? theme[950]
                    : isFocused
                      ? theme[950]
                      : theme[400];
                return (
                    <Pressable
                        key={name}
                        onPress={() => (isCreate ? onCreatePress() : onTabPress(name))}
                        style={styles.tabSlot}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={LABELS[name]}
                    >
                        <Icon name={ICONS[name]} size={28} color={color} />
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
});

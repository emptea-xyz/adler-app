import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { TailwindColors } from '@/constants/TailwindColors';
import { Neutral } from '@/constants/NeutralColors';

const ICONS: Record<string, IconName> = {
    browse: 'safari.fill',
    inbox: 'tray.fill',
    profile: 'person.fill',
    wallet: 'wallet.bifold.fill',
};

const LABELS: Record<string, string> = {
    browse: 'Browse',
    inbox: 'Inbox',
    profile: 'Profile',
    wallet: 'Wallet',
};

const TAB_ORDER = ['browse', 'inbox', 'profile', 'wallet'] as const;

const FAB_SIZE = 56;
const FAB_RAISE = 12;

export function AdlerTabBar({ state, navigation }: BottomTabBarProps) {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { openPostBounty } = useOverlaySheets();

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
                    overflow: 'visible',
                },
            ]}
        >
            {TAB_ORDER.map((name, index) => {
                const isFocused = focusedRouteName === name;
                // Push the two inner tabs (index 1 and 2) outward so they
                // don't visually collide with the centered FAB.
                const innerSpacing =
                    index === 1
                        ? { paddingRight: FAB_SIZE / 2 + 8 }
                        : index === 2
                          ? { paddingLeft: FAB_SIZE / 2 + 8 }
                          : null;
                return (
                    <Pressable
                        key={name}
                        onPress={() => onPress(name)}
                        style={[styles.tabSlot, innerSpacing]}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={LABELS[name]}
                    >
                        <Icon
                            name={ICONS[name]}
                            size={28}
                            color={isFocused ? theme[950] : theme[400]}
                        />
                    </Pressable>
                );
            })}

            <View
                pointerEvents="box-none"
                style={[styles.fabWrap, { bottom: insets.bottom + FAB_RAISE }]}
            >
                <Pressable
                    onPress={onCreatePress}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Create"
                    style={({ pressed }) => [
                        styles.fab,
                        {
                            backgroundColor: TailwindColors.sky[500],
                            opacity: pressed ? 0.9 : 1,
                            transform: [{ scale: pressed ? 0.96 : 1 }],
                        },
                    ]}
                >
                    <Icon name="plus" size={28} color={Neutral.white} weight="bold" />
                </Pressable>
            </View>
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
    fabWrap: {
        position: 'absolute',
        left: '50%',
        marginLeft: -FAB_SIZE / 2,
        width: FAB_SIZE,
        height: FAB_SIZE,
        zIndex: 10,
    },
    fab: {
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: FAB_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Neutral.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 8,
    },
});

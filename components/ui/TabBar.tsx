import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Canvas, Rect, LinearGradient, vec } from '@shopify/react-native-skia';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { TailwindColors } from '@/constants/TailwindColors';

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
                accessibilityLabel={LABELS['inbox']}
            >
                <Icon
                    name={ICONS['inbox']}
                    size={28}
                    color={focusedRouteName === 'inbox' ? theme[950] : theme[200]}
                />
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
        paddingHorizontal: 16,
    },
    tabSlot: {
        flex: 1,
        height: TAB_BAR_HEIGHT - 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

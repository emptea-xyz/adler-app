import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Compass, Inbox, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOverlaySheets } from '@/contexts/OverlaySheetsContext';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { SolanaUploadArrow } from '@/components/ui/SolanaUploadArrow';

const ICONS: Record<string, React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
    browse: Compass,
    inbox: Inbox,
    profile: User,
};

const LABELS: Record<string, string> = {
    browse: 'Browse',
    inbox: 'Inbox',
    create: 'Create',
    profile: 'Profile',
};

const TAB_ORDER = ['browse', 'create', 'inbox', 'profile'] as const;

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
                return (
                    <Pressable
                        key={name}
                        onPress={() => onPress(name)}
                        style={styles.tabSlot}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={LABELS[name]}
                    >
                        <Icon
                            size={22}
                            color={isFocused ? theme[950] : theme[400]}
                            strokeWidth={2}
                        />
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

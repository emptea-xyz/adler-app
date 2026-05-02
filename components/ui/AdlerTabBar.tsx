import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Compass, Bookmark, Inbox, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';
import { SolanaUploadArrow } from '@/components/ui/SolanaUploadArrow';

// Figma node 132:204 — 5 tabs in the order browse, saved, create, inbox,
// profile. Icons only (no labels). The center "create" tab renders the
// gradient upload-arrow Skia icon.

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
                            onPress={() => onPress(name)}
                            style={styles.centerSlot}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={LABELS[name]}
                        >
                            <View style={{ opacity: isFocused ? 1 : 0.85 }}>
                                <SolanaUploadArrow size={52} />
                            </View>
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

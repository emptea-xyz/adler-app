import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Compass, Inbox, Plus, User } from 'lucide-react-native';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { haptic } from '@/lib/utils/haptic';
import { TAB_BAR_HEIGHT } from '@/constants/LayoutConstants';

// Visual layout: 3 tabs flanking a prominent circular Create button.
// Routes (left → right): browse, inbox, create (center CTA), profile.
const ICONS: Record<string, React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
    browse: Compass,
    inbox: Inbox,
    create: Plus,
    profile: User,
};

const LABELS: Record<string, string> = {
    browse: 'Browse',
    inbox: 'Inbox',
    create: 'Create',
    profile: 'Profile',
};

const TAB_ORDER = ['browse', 'inbox', 'create', 'profile'] as const;

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
                    borderTopColor: theme[200],
                    paddingBottom: insets.bottom,
                    height: TAB_BAR_HEIGHT + insets.bottom,
                },
            ]}
        >
            {TAB_ORDER.map((name) => {
                const isCenter = name === 'create';
                const isFocused = focusedRouteName === name;
                const Icon = ICONS[name];

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
                            <View
                                style={[
                                    styles.centerButton,
                                    {
                                        backgroundColor: theme[950],
                                        borderColor: theme[50],
                                    },
                                ]}
                            >
                                <Icon size={22} color={theme[50]} strokeWidth={2.5} />
                            </View>
                        </Pressable>
                    );
                }

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
                            strokeWidth={isFocused ? 2.25 : 2}
                        />
                        <ThemedText
                            type="caption-semibold"
                            style={{
                                color: isFocused ? theme[950] : theme[400],
                                marginTop: 4,
                            }}
                        >
                            {LABELS[name]}
                        </ThemedText>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        borderTopWidth: StyleSheet.hairlineWidth,
        alignItems: 'flex-start',
        paddingTop: 8,
    },
    tabSlot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 4,
    },
    centerSlot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginTop: -22,
    },
    centerButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
});

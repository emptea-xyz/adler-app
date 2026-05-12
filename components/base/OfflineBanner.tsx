import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/base/ThemedText';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { Status } from '@/constants/StatusColors';
import { Neutral } from '@/constants/NeutralColors';

const BANNER_CONTENT_HEIGHT = 28;

export function OfflineBanner() {
    const { isConnected } = useAuth();
    const insets = useSafeAreaInsets();
    const [showOfflineBanner, setShowOfflineBanner] = useState(false);
    const bannerHeight = useSharedValue(0);

    // Total height includes safe area top (for notch/dynamic island) + content
    const totalHeight = insets.top + BANNER_CONTENT_HEIGHT;

    useEffect(() => {
        if (!isConnected) {
            setShowOfflineBanner(true);
        } else {
            // When connection is restored, keep banner for a moment to show "Back Online"
            if (showOfflineBanner) {
                const timer = setTimeout(() => setShowOfflineBanner(false), 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [isConnected, showOfflineBanner]);

    useEffect(() => {
        bannerHeight.value = withTiming(showOfflineBanner ? totalHeight : 0, {
            duration: 300,
            easing: Easing.out(Easing.ease),
        });
    }, [showOfflineBanner, bannerHeight, totalHeight]);

    const bannerStyle = useAnimatedStyle(() => ({
        height: bannerHeight.value,
        opacity: totalHeight > 0 ? bannerHeight.value / totalHeight : 0,
    }));

    return (
        <Animated.View
            style={[
                bannerStyle,
                {
                    backgroundColor: !isConnected ? Status.error : Status.success,
                    overflow: 'hidden',
                    paddingTop: insets.top,
                }
            ]}
            className="items-center justify-center w-full absolute top-0 left-0 right-0 z-50"
        >
            {!isConnected ? (
                <ThemedText type="body-md-semibold" className="!text-white">
                    ⚠️ No Internet Connection
                </ThemedText>
            ) : (
                <View className="flex-row items-center gap-1.5">
                    <Icon name="checkmark" size={16} color={Neutral.white} weight="semibold" />
                    <ThemedText type="body-md-semibold" className="!text-white">
                        Back Online
                    </ThemedText>
                </View>
            )}
        </Animated.View>
    );
}

import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { ThemedView } from './ThemedView';
import { Spinner } from '@/components/ui/Spinner';
import { useTheme } from '@/contexts/ThemeContext';

interface InitialLoadingScreenProps {
  onLoadingComplete: () => void;
  status?: string;
}

export function InitialLoadingScreen({ onLoadingComplete, status }: InitialLoadingScreenProps) {
  const { theme } = useTheme();
  const exitProgress = useSharedValue(0);
  const statusOpacity = useSharedValue(0);

  useEffect(() => {
    let callbackFired = false;
    const safeComplete = () => {
      if (!callbackFired) {
        callbackFired = true;
        onLoadingComplete();
      }
    };

    const fallbackTimeout = setTimeout(safeComplete, 2000);

    statusOpacity.value = withTiming(1, { duration: 200 });

    const animationTimeout = setTimeout(() => {
      exitProgress.value = withTiming(
        1,
        { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) },
        (finished) => {
          if (finished) {
            runOnJS(safeComplete)();
          }
        },
      );
    }, 850);

    return () => {
      clearTimeout(animationTimeout);
      clearTimeout(fallbackTimeout);
    };
  }, [exitProgress, statusOpacity, onLoadingComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exitProgress.value, [0, 1], [1, 0]),
    transform: [{ scale: interpolate(exitProgress.value, [0, 1], [1, 1.02]) }],
  }));

  const statusStyle = useAnimatedStyle(() => ({ opacity: statusOpacity.value }));

  return (
    <Animated.View
      className="flex-1 justify-center items-center"
      style={[{ backgroundColor: theme[50] }, containerStyle]}
    >
      <ThemedView className="items-center" style={{ gap: 24 }}>
        <Spinner size={48} />
        {status && (
          <Animated.Text
            style={[
              statusStyle,
              {
                color: theme[500],
                fontSize: 14,
                fontFamily: 'Geist_600SemiBold',
                letterSpacing: -0.42,
              },
            ]}
          >
            {status}
          </Animated.Text>
        )}
      </ThemedView>
    </Animated.View>
  );
}
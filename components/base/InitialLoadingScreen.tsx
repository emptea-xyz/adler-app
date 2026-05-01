import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { ThemedView } from './ThemedView';
import { useTheme } from '@/contexts/ThemeContext';

interface InitialLoadingScreenProps {
  onLoadingComplete: () => void;
  status?: string;
}

export function InitialLoadingScreen({ onLoadingComplete, status }: InitialLoadingScreenProps) {
  const { theme } = useTheme();
  const progress = useSharedValue(0);
  const exitProgress = useSharedValue(0);
  const statusOpacity = useSharedValue(0);

  useEffect(() => {
    // Track if callback has been called to prevent double-firing
    let callbackFired = false;
    const safeComplete = () => {
      if (!callbackFired) {
        callbackFired = true;
        onLoadingComplete();
      }
    };

    // Fallback timeout: guarantees onLoadingComplete is called even if animation fails
    const fallbackTimeout = setTimeout(safeComplete, 2000);

    // Animate progress bar from 0% to 100%
    progress.value = withTiming(100, {
      duration: 800,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });

    // Fade in status text
    statusOpacity.value = withTiming(1, { duration: 200 });

    // After progress completes, smooth fade out with scale
    const animationTimeout = setTimeout(() => {
      exitProgress.value = withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }, (finished) => {
        if (finished) {
          runOnJS(safeComplete)();
        }
      });
    }, 850);

    return () => {
      clearTimeout(animationTimeout);
      clearTimeout(fallbackTimeout);
    };
  }, [progress, exitProgress, statusOpacity, onLoadingComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exitProgress.value, [0, 1], [1, 0]),
    transform: [
      { scale: interpolate(exitProgress.value, [0, 1], [1, 1.02]) },
    ],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  const statusStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  return (
    <Animated.View
      className="flex-1 justify-center items-center"
      style={[{ backgroundColor: theme[50] }, containerStyle]}
    >
      <ThemedView className="w-4/5 items-center gap-6">
        <View className="w-full h-px overflow-hidden" style={{ backgroundColor: theme[200] }}>
          <Animated.View
            className="h-px"
            style={[progressStyle, { backgroundColor: theme[900] }]}
          />
        </View>

        {/* Status Text */}
        {status && (
          <Animated.Text
            className="text-sm font-semibold"
            style={[statusStyle, { color: theme[500] }]}
          >
            {status}
          </Animated.Text>
        )}
      </ThemedView>
    </Animated.View>
  );
}
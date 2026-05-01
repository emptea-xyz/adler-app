import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface LoadingMotiveProps {
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  fillWidth?: number;
  color?: string;
}

function LoadingMotive({
  duration = 1200,
  delay = 1000,
  style,
  fillWidth = 30,
  color,
}: LoadingMotiveProps) {
  const position = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Delay then fade in
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));

    // Delay then start looping animation
    position.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(100, { duration, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // infinite
        false
      )
    );
  }, [duration, delay, position, opacity]);

  const containerStyle = useAnimatedStyle(() => ({
    width: '80%',
    opacity: opacity.value,
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth}%`,
    backgroundColor: color,
    marginLeft: `${interpolate(position.value, [0, 100], [0, 100 - fillWidth])}%`,
  }));

  return (
    <Animated.View
      style={[containerStyle, style]}
      className="h-px bg-neutral-100 overflow-hidden"
    >
      <Animated.View
        className={!color ? "h-px bg-black" : "h-px"}
        style={fillStyle}
      />
    </Animated.View>
  );
}

export default LoadingMotive;

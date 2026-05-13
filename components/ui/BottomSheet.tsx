import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  View,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardEvent,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { haptic } from "@/lib/utils/haptic";
import { ThemedText } from "@/components/base/ThemedText";
import { AnimationDuration } from "@/constants/LayoutConstants";
import { useTheme } from "@/contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "@/lib/utils/cn";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Easing,
} from "react-native-reanimated";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// Drag threshold to dismiss (percentage of sheet height)
const DISMISS_THRESHOLD = 0.25;

interface BottomSheetHelpers {
  close: (callback?: () => void) => void;
  dismissKeyboard: () => void;
  keyboardVisible: boolean;
  keyboardHeight: number;
}

type BottomSheetChildren =
  | React.ReactNode
  | ((helpers: BottomSheetHelpers) => React.ReactNode);

interface BottomSheetAction {
  /** Icon component to render inside the action button */
  icon: React.ComponentType<{ size?: number; color?: string }>;
  /** Callback invoked when the action button is pressed */
  onPress: () => void;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
}

interface BottomSheetProps {
  /** Whether the bottom sheet is visible */
  visible: boolean;
  /** Callback when the sheet should close */
  onClose: () => void;
  /** Content to render inside the sheet */
  children: BottomSheetChildren;
  /** Custom height for the expanded sheet. Defaults to 420 */
  height?: number;
  /** Whether to enable haptic feedback on close. Defaults to true */
  enableHaptics?: boolean;
  /** Custom margin from screen edges. Defaults to 0 */
  margin?: number;
  /** Whether the sheet can be dismissed via backdrop press or hardware back. Defaults to true */
  dismissible?: boolean;
  /** The title to display in the header */
  title?: string | React.ReactNode;
  /** Optional action button displayed on the left (e.g., back or close) */
  leftAction?: BottomSheetAction;
  /** Optional action button displayed on the right */
  rightAction?: BottomSheetAction;
  /** Optional second action button displayed on the right */
  secondaryRightAction?: BottomSheetAction;
  /** Optional class name for the sheet container */
  className?: string;
  /** Whether to expand to full-screen when keyboard is visible. Defaults to false */
  keyboardAware?: boolean;
  /** Whether to dismiss keyboard when tapping outside input fields. Defaults to true when keyboardAware is true */
  dismissKeyboardOnTap?: boolean;
  /** Optional style override for the sheet container */
  style?: StyleProp<ViewStyle>;
  /** When true, removes inner content padding (px-5 pb-10) for edge-to-edge rendering */
  flush?: boolean;
}

/**
 * BottomSheet Component
 *
 * A simplified animated bottom sheet with fade-up and fade-down transitions.
 * Supports drag-to-dismiss when dismissible is true.
 *
 * Keyboard-aware mode (keyboardAware={true}):
 * - Automatically expands to full-screen when keyboard is visible
 * - Adds padding to ensure content is not hidden behind the keyboard
 * - Wraps content in TouchableWithoutFeedback to dismiss keyboard on tap
 * - Provides keyboard state via render props (keyboardVisible, keyboardHeight)
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  height = 420,
  enableHaptics = true,
  margin = 0,
  dismissible = true,
  title,
  leftAction,
  rightAction,
  secondaryRightAction,
  className,
  keyboardAware = false,
  dismissKeyboardOnTap,
  style,
  flush = false,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { height: screenHeight } = useWindowDimensions();

  // Keyboard state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Calculate full-screen height (screen height minus top safe area)
  const fullScreenHeight = screenHeight - insets.top;

  // Shared values for entrance/exit and gestures
  const backdropOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(0);
  const containerTranslateY = useSharedValue(20);
  const containerHeight = useSharedValue(height);
  const dragY = useSharedValue(0);

  const isClosingRef = useRef(false);

  // Keyboard listeners — iOS-only `*Will*` events fire before the keyboard
  // animates so the sheet animates in lockstep. Android `*Did*` fallbacks
  // were dropped as part of the iOS-only cutover.
  useEffect(() => {
    if (!keyboardAware) return;

    const handleKeyboardShow = (event: KeyboardEvent) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
    };

    const handleKeyboardHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener('keyboardWillShow', handleKeyboardShow);
    const hideSubscription = Keyboard.addListener('keyboardWillHide', handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardAware]);

  // Animate height when keyboard visibility changes
  useEffect(() => {
    if (!keyboardAware || !visible || isClosingRef.current) return;

    const targetHeight = keyboardVisible ? fullScreenHeight : height;
    containerHeight.value = withTiming(targetHeight, {
      duration: AnimationDuration.normal,
      easing: Easing.inOut(Easing.ease),
    });
  }, [keyboardVisible, keyboardAware, visible, fullScreenHeight, height, containerHeight]);

  useEffect(() => {
    if (visible && !isClosingRef.current) {
      containerHeight.value = withTiming(height, { duration: AnimationDuration.normal, easing: Easing.inOut(Easing.ease) });
    }
  }, [height, visible, containerHeight]);

  // Entrance/Exit animation
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      dragY.value = 0;
      backdropOpacity.value = withTiming(1, { duration: AnimationDuration.fast });
      containerOpacity.value = withTiming(1, { duration: AnimationDuration.fast });
      containerTranslateY.value = withTiming(0, { duration: AnimationDuration.fast, easing: Easing.out(Easing.quad) });
    } else {
      // If we're already closing via gesture, don't reset values immediately
      // as it might cause a flicker. The Modal visibility is controlled by the 'visible' prop.
      if (!isClosingRef.current) {
        backdropOpacity.value = 0;
        containerOpacity.value = 0;
        containerTranslateY.value = 20;
        dragY.value = 0;
      }
    }
  }, [visible, backdropOpacity, containerOpacity, containerTranslateY, dragY]);

  const triggerClose = useCallback(() => {
    if (enableHaptics) {
      haptic('light');
    }
    isClosingRef.current = false;
    onClose();
  }, [enableHaptics, onClose]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const closeSheet = useCallback(
    ({ force = false, callback }: { force?: boolean; callback?: () => void } = {}) => {
      if (!force && !dismissible) return;
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      // Dismiss keyboard before closing
      if (keyboardAware) {
        Keyboard.dismiss();
      }

      backdropOpacity.value = withTiming(0, { duration: AnimationDuration.fast });
      containerOpacity.value = withTiming(0, { duration: AnimationDuration.fast });
      containerTranslateY.value = withTiming(20, { duration: AnimationDuration.fast, easing: Easing.in(Easing.quad) }, () => {
        runOnJS(triggerClose)();
        if (callback) runOnJS(callback)();
      });
    },
    [dismissible, keyboardAware, backdropOpacity, containerOpacity, containerTranslateY, triggerClose]
  );

  // Pan gesture for drag-to-dismiss
  const panGesture = Gesture.Pan()
    .enabled(dismissible)
    .activeOffsetY([10, 10])
    .onUpdate((event) => {
      if (event.translationY > 0) {
        dragY.value = event.translationY;
      } else {
        dragY.value = event.translationY / 4; // Resistance when dragging up
      }
    })
    .onEnd((event) => {
      const threshold = containerHeight.value * DISMISS_THRESHOLD;
      if (event.translationY > threshold || event.velocityY > 500) {
        dragY.value = withTiming(containerHeight.value, { duration: AnimationDuration.fast }, () => {
          runOnJS(triggerClose)();
        });
      } else {
        dragY.value = withTiming(0, { duration: AnimationDuration.normal, easing: Easing.out(Easing.quad) });
      }
    });

  const dragStyle = useAnimatedStyle(() => {
    // When dragY is positive (dragging down), we translate.
    // When dragY is negative (dragging up), we increase height instead of translating up
    // to prevent exposing the gap at the bottom of the screen.
    const translateY = (dragY.value > 0 ? dragY.value : 0) + containerTranslateY.value;
    const extraHeight = dragY.value < 0 ? -dragY.value : 0;

    return {
      transform: [{ translateY }],
      opacity: containerOpacity.value,
      height: containerHeight.value + extraHeight,
    };
  });

  const backdropDragStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dragY.value,
      [0, containerHeight.value * DISMISS_THRESHOLD],
      [1, 0.5],
      'clamp'
    ) * backdropOpacity.value,
  }));

  const blurViewStyle = useAnimatedStyle(() => ({
    flex: 1,
  }));

  const renderedChildren =
    typeof children === "function"
      ? children({
        close: (cb?: () => void) => closeSheet({ force: true, callback: cb }),
        dismissKeyboard,
        keyboardVisible,
        keyboardHeight,
      })
      : children;

  if (!visible && !isClosingRef.current) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        if (dismissible) {
          closeSheet();
        }
      }}
    >
      <View className="flex-1">
        {/* Backdrop */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            backdropDragStyle,
            { backgroundColor: 'rgba(0, 0, 0, 0.2)' }
          ]}
        >
          <AnimatedBlurView
            intensity={80}
            className="absolute inset-0"
            style={blurViewStyle}
          >
            <Pressable
              className="absolute inset-0"
              onPress={dismissible ? () => closeSheet() : undefined}
            />
          </AnimatedBlurView>
        </Animated.View>

        <View
          className="absolute inset-x-0 bottom-0"
          pointerEvents="box-none"
          style={{ paddingHorizontal: margin }}
        >
          <Animated.View
            className={cn(
              "overflow-hidden w-full rounded-t-2xl",
              className
            )}
            style={[dragStyle, { backgroundColor: theme[50] }, style]}
          >
            {/* Drag Handle */}
            {dismissible && (
              <GestureDetector gesture={panGesture}>
                <View className="items-center pt-3 pb-1">
                  <View className="w-10 h-1 rounded-full" style={{ backgroundColor: theme[300] }} />
                </View>
              </GestureDetector>
            )}

            {/* Header */}
            {(title || leftAction || rightAction || secondaryRightAction) && (
              <View className="flex-row items-center justify-between px-5 pt-2 pb-2 gap-2">
                <View className="w-10">
                  {leftAction ? (
                    <Pressable
                      onPress={() => {
                        haptic('light');
                        leftAction.onPress();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={leftAction.accessibilityLabel || "Close"}
                      testID="sheet-left-action"
                      className="w-10 h-10 items-center justify-center rounded-full active:opacity-70"
                    >
                      <leftAction.icon size={24} color={theme[900]} />
                    </Pressable>
                  ) : (
                    <View className="w-10" />
                  )}
                </View>

                {title && (
                  typeof title === "string" ? (
                    <ThemedText type="h6" align="center" className="flex-1 py-4" numberOfLines={1}>
                      {title}
                    </ThemedText>
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      {title}
                    </View>
                  )
                )}

                <View className="flex-row items-center gap-1">
                  {secondaryRightAction && (
                    <Pressable
                      onPress={() => {
                        haptic('light');
                        secondaryRightAction.onPress();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={secondaryRightAction.accessibilityLabel}
                      className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
                    >
                      <secondaryRightAction.icon size={24} color={theme[900]} />
                    </Pressable>
                  )}
                  {rightAction ? (
                    <Pressable
                      onPress={() => {
                        haptic('light');
                        rightAction.onPress();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={rightAction.accessibilityLabel}
                      className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
                    >
                      <rightAction.icon size={24} color={theme[900]} />
                    </Pressable>
                  ) : (
                    <View className="w-10" />
                  )}
                </View>
              </View>
            )}

            {/* Content — bottom padding clears the home-indicator safe area so action buttons never sit on top of it. */}
            {(() => {
              const safeBottom = Math.max(insets.bottom + 16, 24);
              if (keyboardAware && (dismissKeyboardOnTap ?? true)) {
                return (
                  <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
                    <View
                      className={cn("flex-1 px-5")}
                      style={{ paddingBottom: keyboardVisible ? keyboardHeight + 20 : safeBottom }}
                    >
                      {renderedChildren}
                    </View>
                  </TouchableWithoutFeedback>
                );
              }
              return (
                <View
                  className={cn("flex-1", !flush && "px-5", !flush && !(title || leftAction || rightAction || secondaryRightAction) && "pt-5")}
                  style={!flush ? { paddingBottom: safeBottom } : undefined}
                >
                  {renderedChildren}
                </View>
              );
            })()}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}


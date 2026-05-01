/**
 * haptic.ts
 *
 * Standardized haptic feedback utility for consistent tactile feedback.
 * Use semantic presets instead of calling Haptics directly.
 *
 * Usage:
 *   import { haptic } from '@/lib/utils/haptic';
 *   haptic('light');        // Button tap, card tap
 *   haptic('medium');       // Confirmable action (Pay tap, Apply submit)
 *   haptic('heavy');        // Major event (payment confirmed, award succeeded)
 *   haptic('success');      // Success notification
 *   haptic('error');        // Error notification
 */

import * as Haptics from 'expo-haptics';

type ImpactType = 'light' | 'medium' | 'heavy';
type NotificationType = 'success' | 'warning' | 'error';
type SelectionType = 'selection';
type HapticType = ImpactType | NotificationType | SelectionType;

const IMPACT_MAP: Record<ImpactType, Haptics.ImpactFeedbackStyle> = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

const NOTIFICATION_MAP: Record<NotificationType, Haptics.NotificationFeedbackType> = {
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
    error: Haptics.NotificationFeedbackType.Error,
};

/**
 * Trigger haptic feedback with semantic presets. Silently fails on devices
 * without haptic support.
 */
export function haptic(type: HapticType = 'light'): void {
    try {
        if (type === 'selection') {
            Haptics.selectionAsync().catch(() => { });
        } else if (type in IMPACT_MAP) {
            Haptics.impactAsync(IMPACT_MAP[type as ImpactType]).catch(() => { });
        } else if (type in NOTIFICATION_MAP) {
            Haptics.notificationAsync(NOTIFICATION_MAP[type as NotificationType]).catch(() => { });
        }
    } catch {
        // Silently fail on unsupported devices
    }
}

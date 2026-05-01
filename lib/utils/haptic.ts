/**
 * haptic.ts
 * 
 * Standardized haptic feedback utility for consistent tactile feedback.
 * Use semantic presets instead of calling Haptics directly.
 * 
 * Usage:
 *   import { haptic } from '@/lib/utils/haptic';
 *   haptic('light');        // Button tap
 *   haptic('medium');       // Important action
 *   haptic('success');      // Success notification
 *   haptic('error');        // Error notification
 */

import * as Haptics from 'expo-haptics';

type ImpactType = 'light' | 'medium' | 'heavy';
type NotificationType = 'success' | 'warning' | 'error';
type SelectionType = 'selection';
type HapticType = ImpactType | NotificationType | SelectionType;

/** Maps impact types to Haptics.ImpactFeedbackStyle */
const IMPACT_MAP: Record<ImpactType, Haptics.ImpactFeedbackStyle> = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

/** Maps notification types to Haptics.NotificationFeedbackType */
const NOTIFICATION_MAP: Record<NotificationType, Haptics.NotificationFeedbackType> = {
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
    error: Haptics.NotificationFeedbackType.Error,
};

/**
 * Trigger haptic feedback with semantic presets.
 * Silently fails on devices without haptic support.
 *
 * Uses efficient object lookups instead of switch statements.
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

// =============================================================================
// CELEBRATION HAPTICS — Multi-burst patterns for milestone events
// =============================================================================

type CelebrationType = 'pr' | 'levelUp' | 'badge' | 'premium';

/**
 * Celebration haptic sequences with distinct rhythms per event type.
 * Each entry is [delayMs, hapticType] — played sequentially from the first burst.
 *
 * PR:       heavy → 80ms → success        (quick double-tap, ~250ms total)
 * Level-Up: light → medium → heavy → success (escalating, ~400ms total)
 * Badge:    medium → selection → success   (unlock feel, ~300ms total)
 */
const CELEBRATION_PATTERNS: Record<CelebrationType, [number, HapticType][]> = {
    pr: [
        [0, 'heavy'],
        [80, 'heavy'],
        [180, 'success'],
    ],
    levelUp: [
        [0, 'light'],
        [100, 'medium'],
        [200, 'heavy'],
        [320, 'success'],
    ],
    badge: [
        [0, 'medium'],
        [100, 'selection'],
        [220, 'success'],
    ],
    premium: [
        [0, 'light'],
        [100, 'medium'],
        [200, 'heavy'],
        [320, 'heavy'],
        [450, 'success'],
    ],
};

/**
 * Play a multi-burst haptic celebration for milestone events.
 * Silently fails on unsupported devices.
 *
 * Usage:
 *   hapticCelebration('pr');       // New personal record
 *   hapticCelebration('levelUp');  // Level-up
 *   hapticCelebration('badge');    // Badge unlocked
 */
export function hapticCelebration(type: CelebrationType): void {
    const pattern = CELEBRATION_PATTERNS[type];
    if (!pattern) return;

    for (const [delay, hapticType] of pattern) {
        if (delay === 0) {
            haptic(hapticType);
        } else {
            setTimeout(() => haptic(hapticType), delay);
        }
    }
}

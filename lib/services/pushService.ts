import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export type PushPermissionState = 'granted' | 'undetermined' | 'denied';

export function canReceivePushNotifications(): boolean {
    return Device.isDevice;
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
    if (!canReceivePushNotifications()) return 'denied';
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'undetermined') return 'undetermined';
    return 'denied';
}

/**
 * Request notification permissions (iOS prompt) and obtain an Expo push token.
 *
 * Returns `null` when:
 * - the user denies permission
 * - we're running on the simulator (no APNs)
 * - the request fails for any other reason (logged, not thrown)
 *
 * Caller persists the token on the user's profile via `setPushToken` so the
 * Cloud Function triggers can target this device.
 */
export async function registerForPushAsync(
    options: { requestPermission?: boolean } = {},
): Promise<string | null> {
    const { requestPermission = true } = options;

    if (!canReceivePushNotifications()) {
        // Simulator can't receive APNs pushes; skip silently.
        return null;
    }

    try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let granted = existing === 'granted';
        if (!granted && requestPermission) {
            const { status } = await Notifications.requestPermissionsAsync({
                ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: true,
                },
            });
            granted = status === 'granted';
        }
        if (!granted) return null;

        // expo-notifications v0.28+ requires a projectId for production tokens.
        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ??
            // @ts-ignore — older Expo SDKs put it under easConfig
            Constants.easConfig?.projectId;
        if (!projectId) {
            if (__DEV__) console.warn('Push: no EAS projectId in app config');
            return null;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        return tokenResponse.data ?? null;
    } catch (err) {
        if (__DEV__) console.warn('Push: registration failed', err);
        return null;
    }
}

export function addPushTokenRotationListener(
    onToken: (token: string) => void,
): { remove: () => void } {
    return Notifications.addPushTokenListener((token) => {
        if (token.data) onToken(token.data);
    });
}

/**
 * Configure foreground notification presentation so banners + sounds appear
 * while the app is in the foreground. iOS-only — this app doesn't ship to
 * Android (see app.json `platforms`).
 */
export function setupForegroundHandler() {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

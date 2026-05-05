import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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
export async function registerForPushAsync(): Promise<string | null> {
    if (!Device.isDevice) {
        // Simulator can't receive APNs pushes; skip silently.
        return null;
    }

    try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let granted = existing === 'granted';
        if (!granted) {
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

/**
 * iOS-only: configure a default notification channel-equivalent so banners +
 * sounds appear while the app is in the foreground. Android also goes through
 * this code path harmlessly.
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

    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
        }).catch(() => {});
    }
}

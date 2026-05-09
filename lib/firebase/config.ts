import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, persistentSingleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
// @ts-ignore - Firebase types for RN interactions can be tricky
import { getAuth, initializeAuth, type Auth, getReactNativePersistence } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const requiredEnvVars = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
} as const;

const missing = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

if (missing.length > 0) {
    throw new Error(
        `Missing required Firebase environment variables: ${missing.join(', ')}. ` +
        'Ensure your .env file is configured correctly.'
    );
}

const firebaseConfig = {
    ...requiredEnvVars as Record<string, string>,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app;
let auth: Auth;

if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    // Initialize Auth with persistence
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });

    // App Check.
    //
    // We use the JS SDK throughout the app (firebase/firestore, firebase/auth,
    // firebase/functions, firebase/storage), so we need a CustomProvider that
    // bridges to the native @react-native-firebase/app-check module — it's the
    // only path that gives us real Apple App Attest tokens on iOS.
    //
    // On simulators (no App Attest hardware), the debug provider is used.
    // Grab the debug token Firebase prints to the console on first launch and
    // register it under "Debug tokens" in the App Check Firebase Console.
    //
    // Until App Check is enabled in the Firebase Console (Monitor mode is the
    // safe first step), this is a no-op for our backends — they don't yet
    // require tokens. Defer enforcement until you've confirmed legit clients
    // are passing in Monitor mode.
    if (Platform.OS === 'ios' && !__DEV__) {
        // Lazy require keeps the JS-only web bundle happy + survives test runs
        // where the native module isn't linked.
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const rnAppCheck = require('@react-native-firebase/app-check');
            const {
                ReactNativeFirebaseAppCheckProvider,
                initializeAppCheck: rnInitializeAppCheck,
                getToken: rnGetToken,
            } = rnAppCheck;

            const rnfbProvider = new ReactNativeFirebaseAppCheckProvider();
            rnfbProvider.configure({
                apple: { provider: 'appAttestWithDeviceCheckFallback' },
                isTokenAutoRefreshEnabled: true,
            });

            const rnAppCheckInstance = rnInitializeAppCheck(undefined, {
                provider: rnfbProvider,
                isTokenAutoRefreshEnabled: true,
            });

            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { CustomProvider } = require('firebase/app-check');
            const bridgeProvider = new CustomProvider({
                getToken: async () => {
                    const instance = await rnAppCheckInstance;
                    const { token, expireTimeMillis } = await rnGetToken(instance);
                    return { token, expireTimeMillis };
                },
            });
            initializeAppCheck(app, {
                provider: bridgeProvider,
                isTokenAutoRefreshEnabled: true,
            });
        } catch (err) {
            if (__DEV__) console.warn('App Check init failed', err);
        }
    } else if (Platform.OS === 'web') {
        if (!__DEV__) {
            initializeAppCheck(app, {
                provider: new ReCaptchaEnterpriseProvider('RECAPTCHA_ENTERPRISE_SITE_KEY'),
                isTokenAutoRefreshEnabled: true,
            });
        } else {
            // @ts-ignore - App Check debug token for local development
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
            initializeAppCheck(app, {
                provider: new ReCaptchaEnterpriseProvider('debug'),
                isTokenAutoRefreshEnabled: true,
            });
        }
    }
} else {
    app = getApp();
    auth = getAuth(app);
}

const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: Platform.OS === 'web'
            ? persistentMultipleTabManager()
            : persistentSingleTabManager({ forceOwnership: true }),
    }),
});
const storage = getStorage(app);
const functions = getFunctions(app);

export { auth, db, storage, functions };

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

    // Initialize App Check
    // WARNING: In React Native (Expo) using the Firebase JS SDK, native App Check (DeviceCheck/Play Integrity) 
    // requires a custom native module (like @react-native-firebase/app-check).
    // The ReCaptcha provider is used here as a fallback/web provider.
    // Do NOT strictly enforce App Check in the Firebase Console until you've integrated a native App Check library,
    // otherwise, legitimate iOS/Android devices will be blocked.
    if (Platform.OS === 'web') {
        if (!__DEV__) {
            initializeAppCheck(app, {
                provider: new ReCaptchaEnterpriseProvider('RECAPTCHA_ENTERPRISE_SITE_KEY'), // Replace with actual key
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
    } else {
        if (__DEV__) console.warn("Native App Check isn't configured yet. Install @react-native-firebase/app-check and use CustomProvider to link it with JS SDK for iOS/Android.");
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

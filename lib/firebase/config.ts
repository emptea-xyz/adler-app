import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
// @ts-ignore - Firebase types for RN interactions can be tricky
import { getAuth, initializeAuth, type Auth, getReactNativePersistence } from 'firebase/auth';
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
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
} else {
    app = getApp();
    auth = getAuth(app);
}

// Firestore JS SDK only ships IndexedDB-backed persistence; React Native
// has no IndexedDB, so persistentLocalCache logs a noisy warning before
// falling back to memory. Skip it entirely on native.
const db =
    Platform.OS === 'web'
        ? initializeFirestore(app, {
              localCache: persistentLocalCache({
                  tabManager: persistentMultipleTabManager(),
              }),
          })
        : initializeFirestore(app, {});
const storage = getStorage(app);
const functions = getFunctions(app);

export { auth, db, storage, functions };

import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, functions } from '@/lib/firebase/config';

type MintTokenResponse = {
    token: string;
    uid: string;
};

const mintFirebaseTokenFn = httpsCallable<{ accessToken: string }, MintTokenResponse>(
    functions,
    'mintFirebaseToken',
);

/**
 * Exchange a Privy access token for a Firebase custom token and sign in.
 * The resulting Firebase auth uid matches the Privy user id (`did:privy:...`),
 * so Firestore rules using `request.auth.uid == <userId>` keep working.
 */
export async function bridgeToFirebase(privyAccessToken: string): Promise<string> {
    const result = await mintFirebaseTokenFn({ accessToken: privyAccessToken });
    if (!result.data?.token) {
        throw new Error('mintFirebaseToken returned no token');
    }
    await signInWithCustomToken(auth, result.data.token);
    return result.data.uid;
}

export async function signOutOfFirebase(): Promise<void> {
    if (auth.currentUser) {
        await firebaseSignOut(auth);
    }
}

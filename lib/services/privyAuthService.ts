import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, functions } from '@/lib/firebase/config';

type MintTokenResponse = {
    token: string;
    uid: string;
};

type DeleteAccountResponse = {
    ok: boolean;
};

const mintFirebaseTokenFn = httpsCallable<{ accessToken: string }, MintTokenResponse>(
    functions,
    'mintFirebaseToken',
);

const deleteUserAccountFn = httpsCallable<Record<string, never>, DeleteAccountResponse>(
    functions,
    'deleteUserAccount',
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

/**
 * Server-side account deletion: archives the user's listings, removes profile
 * + username claim, revokes the Firebase auth user. Caller is responsible for
 * Privy logout afterwards (the Privy session itself isn't touched here).
 */
export async function deleteAccount(): Promise<void> {
    await deleteUserAccountFn({});
}

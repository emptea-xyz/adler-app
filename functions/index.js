import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import { PrivyClient } from '@privy-io/server-auth';

admin.initializeApp();

const PRIVY_APP_ID = defineSecret('PRIVY_APP_ID');
const PRIVY_APP_SECRET = defineSecret('PRIVY_APP_SECRET');

let privyClient = null;
function getPrivyClient() {
  if (!privyClient) {
    privyClient = new PrivyClient(PRIVY_APP_ID.value(), PRIVY_APP_SECRET.value());
  }
  return privyClient;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `${name} is required`);
  }
  return value;
}

// Privy access token → Firebase custom token. The Firebase auth uid is set to
// the Privy user id ("did:privy:..."), so existing Firestore rules using
// `request.auth.uid == <userId>` continue to work.
export const mintFirebaseToken = onCall(
  { secrets: [PRIVY_APP_ID, PRIVY_APP_SECRET] },
  async (request) => {
    const accessToken = requireString(request.data?.accessToken, 'accessToken');

    let claims;
    try {
      claims = await getPrivyClient().verifyAuthToken(accessToken);
    } catch (err) {
      throw new HttpsError('unauthenticated', 'Invalid Privy access token', {
        cause: err?.message,
      });
    }

    const uid = claims.userId;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Privy token has no user id');
    }

    const customToken = await admin.auth().createCustomToken(uid, {
      privyAppId: claims.appId ?? null,
    });

    return { token: customToken, uid };
  },
);

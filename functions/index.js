import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import { verifyAccessToken } from '@privy-io/node';
import { createRemoteJWKSet } from 'jose';

admin.initializeApp();

const PRIVY_APP_ID = defineSecret('PRIVY_APP_ID');

// JWKS resolver is cached at module scope so warm Cloud Function invocations
// reuse the same key set instead of re-fetching `jwks.json` each call.
let jwksCache = null;
let jwksCacheAppId = null;
function getJwks(appId) {
  if (jwksCache && jwksCacheAppId === appId) return jwksCache;
  jwksCacheAppId = appId;
  jwksCache = createRemoteJWKSet(
    new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`),
  );
  return jwksCache;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `${name} is required`);
  }
  return value;
}

// Privy access token → Firebase custom token. The Firebase auth uid is set to
// the Privy user id, so existing Firestore rules using
// `request.auth.uid == <userId>` continue to work.
//
// Verification only needs the public Privy app id + JWKS endpoint — no app
// secret. The PRIVY_APP_SECRET in Secret Manager is retained for future
// server-side management API calls (creating wallets, etc.) but isn't read
// here.
export const mintFirebaseToken = onCall(
  { secrets: [PRIVY_APP_ID] },
  async (request) => {
    const accessToken = requireString(request.data?.accessToken, 'accessToken');
    const appId = PRIVY_APP_ID.value();

    let claims;
    try {
      claims = await verifyAccessToken({
        access_token: accessToken,
        app_id: appId,
        verification_key: getJwks(appId),
      });
    } catch (err) {
      throw new HttpsError('unauthenticated', 'Invalid Privy access token', {
        cause: err?.message,
      });
    }

    const uid = claims.user_id;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Privy token has no user id');
    }

    const customToken = await admin.auth().createCustomToken(uid, {
      privyAppId: claims.app_id ?? null,
    });

    return { token: customToken, uid };
  },
);

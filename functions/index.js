import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { Buffer } from 'node:buffer';
import admin from 'firebase-admin';
import { verifyAccessToken } from '@privy-io/node';
import { createRemoteJWKSet } from 'jose';

admin.initializeApp();

const PRIVY_APP_ID = defineSecret('PRIVY_APP_ID');
const PRIVY_APP_SECRET = defineSecret('PRIVY_APP_SECRET');
const HELIUS_RPC_URL = defineSecret('HELIUS_RPC_URL');
const HELIUS_RPC_URL_DEVNET = defineSecret('HELIUS_RPC_URL_DEVNET');

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

// ─────────────────────────────────────────────────────────────────────────
// Expo Push helper
// ─────────────────────────────────────────────────────────────────────────
//
// Uses Expo's hosted push service (https://exp.host) — no APNs cert plumbing
// required for TestFlight; production Apple Store builds need an APNs key
// uploaded via `eas credentials`. Helper is fault-tolerant: a missing token,
// a network blip, or an Expo error is logged and never bubbles up to the
// caller (we don't want push failures rolling back marketplace state).

async function sendExpoPush(messages) {
  const valid = messages.filter((m) => m && typeof m.to === 'string' && m.to.length > 0);
  if (valid.length === 0) return;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(valid),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`Expo push HTTP ${res.status}: ${body}`);
    }
  } catch (err) {
    console.warn('Expo push request failed', err);
  }
}

async function pushTokenFor(userId) {
  if (!userId) return null;
  const snap = await admin.firestore().collection('profiles').doc(userId).get();
  if (!snap.exists) return null;
  return snap.data()?.pushToken ?? null;
}

/**
 * Bump the user's latestActivityAt — drives the inbox unread dot. Admin SDK
 * write bypasses the profile rule, which deliberately doesn't allow client
 * writes to this field. Best-effort.
 */
async function bumpActivity(userId) {
  if (!userId) return;
  try {
    await admin
      .firestore()
      .collection('profiles')
      .doc(userId)
      .set(
        { latestActivityAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
  } catch (err) {
    console.warn('bumpActivity failed', err);
  }
}

function fmtSol(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  return parseFloat(amount.toFixed(3)).toString();
}

/**
 * Write one /notifications/{auto} doc for a recipient. Server-only — the
 * Firestore rule rejects client creates with `if false`; admin SDK
 * bypasses. Best-effort: a failed write logs but never throws, since the
 * Expo push (where applicable) is the audit trail and a missing in-app
 * row is tolerated.
 */
async function emitNotification({
  recipientId,
  kind,
  title,
  body,
  href,
  refs,
}) {
  if (!recipientId || !kind || !title) return;
  try {
    await admin.firestore().collection('notifications').add({
      recipientId,
      kind,
      title: String(title).slice(0, 120),
      body: typeof body === 'string' ? body.slice(0, 240) : '',
      href: typeof href === 'string' ? href : '/notifications',
      refs: refs && typeof refs === 'object' ? refs : {},
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('emitNotification failed', err);
  }
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

// Account deletion — required for App Store §5.1.1(v).
//
// Pauses the caller's active packages and closes their open gigs (so the
// listings disappear from Browse), removes the profile + username claim, then
// revokes both the Firebase auth user AND the upstream Privy user so signing
// back in produces a brand-new account. We deliberately retain orders,
// applications, reviews, and packages/gigs as `paused`/`closed` for audit +
// counter-party integrity.
async function deletePrivyUser(privyUserId, appId, appSecret) {
  // Privy user IDs are `did:privy:<...>`; the admin API expects the bare
  // tail. Strip the prefix if present so both formats work.
  const tail = privyUserId.startsWith('did:privy:')
    ? privyUserId.slice('did:privy:'.length)
    : privyUserId;
  const auth = Buffer.from(`${appId}:${appSecret}`).toString('base64');
  const res = await fetch(`https://api.privy.io/v1/users/${tail}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${auth}`,
      'privy-app-id': appId,
    },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    throw new Error(`Privy delete HTTP ${res.status}: ${body}`);
  }
}

export const deleteUserAccount = onCall(
  { secrets: [PRIVY_APP_ID, PRIVY_APP_SECRET] },
  async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to delete an account.');
  }
  const uid = request.auth.uid;
  const db = admin.firestore();

  // Archive listings owned by this user. Best-effort — partial failures don't
  // block the rest of the deletion (caller's listings will be re-archived on
  // their first re-login if a fresh profile is made).
  const archivePackages = async () => {
    const snap = await db
      .collection('packages')
      .where('sellerId', '==', uid)
      .where('status', '==', 'active')
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, { status: 'paused' });
    }
    await batch.commit();
  };
  const archiveGigs = async () => {
    const snap = await db
      .collection('gigs')
      .where('brandId', '==', uid)
      .where('status', '==', 'open')
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, { status: 'closed' });
    }
    await batch.commit();
  };

  // Read the profile to learn the username slug, before we delete the doc.
  let username = null;
  const profileSnap = await db.collection('profiles').doc(uid).get();
  if (profileSnap.exists) {
    username = profileSnap.data()?.username ?? null;
  }

  await Promise.all([
    archivePackages().catch(() => null),
    archiveGigs().catch(() => null),
  ]);

  await db.collection('profiles').doc(uid).delete().catch(() => null);
  if (username) {
    await db.collection('usernames').doc(username).delete().catch(() => null);
  }

  // Revoke the upstream Privy user *before* the Firebase auth user — if Privy
  // succeeds and Firebase fails, the user can still sign back in (Privy will
  // re-bridge); if Firebase succeeds and Privy fails, the user has a stale
  // Privy account with no Firebase shadow, also tolerable. Privy first means
  // the user-facing identity disappears in the right order.
  try {
    await deletePrivyUser(uid, PRIVY_APP_ID.value(), PRIVY_APP_SECRET.value());
  } catch (err) {
    console.warn('Privy user deletion failed (continuing with Firebase delete)', err?.message);
    // Non-fatal: we still revoke Firebase below so the local app state clears.
  }

  // Revoke the Firebase auth user. If this throws, the data delete already
  // happened so the next sign-in yields a clean profile.
  try {
    await admin.auth().deleteUser(uid);
  } catch (err) {
    throw new HttpsError(
      'internal',
      'Profile data was deleted but the auth user could not be revoked. Sign out and sign in again to retry.',
      { cause: err?.message },
    );
  }

  return { ok: true };
  },
);

// Reconcile orders that got stuck in `pending` — typically the app died
// mid-transfer before paymentService.payForListing could mark them failed.
// Runs every 30 minutes; flips any `pending` order older than 1 hour to
// `failed` so it doesn't pollute the buyer's inbox forever.
//
// Note: paymentService already does this client-side on transfer failure.
// This is the safety net for the rare crash-mid-tx case.
export const reconcilePendingOrders = onSchedule('every 30 minutes', async () => {
  const db = admin.firestore();
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
  const snap = await db
    .collection('orders')
    .where('status', '==', 'pending')
    .where('createdAt', '<=', cutoff)
    .get();

  if (snap.empty) {
    console.log('reconcilePendingOrders: nothing to do');
    return;
  }

  // Firestore batches cap at 500 writes — chunk if we ever stack up that many.
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    const batch = db.batch();
    for (const docSnap of chunk) {
      batch.update(docSnap.ref, {
        status: 'failed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
  console.log(`reconcilePendingOrders: marked ${docs.length} stale pendings as failed`);
});

// When a gig moves out of `open` (closed by the brand or awarded to a
// creator), auto-reject any still-pending applications so creators don't see
// a stale `pending` in their inbox forever. Awarded applications keep their
// status — only `pending` ones are touched.
export const cascadeApplicationsOnGigClose = onDocumentUpdated(
  'gigs/{gigId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const wasOpen = before.status === 'open';
    const nowTerminal = after.status === 'closed' || after.status === 'awarded';
    if (!wasOpen || !nowTerminal) return;

    const gigId = event.params.gigId;
    const db = admin.firestore();
    const snap = await db
      .collection('gigApplications')
      .where('gigId', '==', gigId)
      .where('status', '==', 'pending')
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, { status: 'rejected' });
    }
    await batch.commit();
    console.log(
      `cascadeApplicationsOnGigClose: rejected ${snap.size} pending apps for gig ${gigId}`,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Push notification triggers
// ─────────────────────────────────────────────────────────────────────────

// New application on a gig → ping the brand.
export const notifyApplicationReceived = onDocumentCreated(
  'gigApplications/{id}',
  async (event) => {
    const app = event.data?.data();
    if (!app) return;
    const db = admin.firestore();
    const gigSnap = await db.collection('gigs').doc(app.gigId).get();
    if (!gigSnap.exists) return;
    const gig = gigSnap.data();
    if (!gig?.brandId || gig.brandId === app.creatorId) return;
    await bumpActivity(gig.brandId);
    const title = 'New application';
    const body = `Someone applied to "${gig.title}".`;
    await emitNotification({
      recipientId: gig.brandId,
      kind: 'application_received',
      title,
      body,
      href: '/applicants',
      refs: { applicationId: event.params.id, listingId: app.gigId },
    });
    const token = await pushTokenFor(gig.brandId);
    if (!token) return;
    await sendExpoPush([
      {
        to: token,
        sound: 'default',
        title,
        body,
        data: { kind: 'gigApplication', gigId: app.gigId, applicationId: event.params.id },
      },
    ]);
  },
);

// Application status flips → ping the creator.
export const notifyApplicationDecided = onDocumentUpdated(
  'gigApplications/{id}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    let title;
    let body;
    if (after.status === 'shortlisted') {
      title = 'Shortlisted';
      body = 'A brand shortlisted your application.';
    } else if (after.status === 'awarded') {
      title = 'You won the gig';
      body = 'Payment is on its way to your wallet.';
    } else if (after.status === 'rejected') {
      title = 'Application closed';
      body = 'This gig moved on without you.';
    } else {
      return;
    }

    await bumpActivity(after.creatorId);
    await emitNotification({
      recipientId: after.creatorId,
      kind: 'application_decided',
      title,
      body,
      href: '/inbox/application_' + event.params.id,
      refs: { applicationId: event.params.id, listingId: after.gigId },
    });
    const token = await pushTokenFor(after.creatorId);
    if (!token) return;
    await sendExpoPush([
      {
        to: token,
        sound: 'default',
        title,
        body,
        data: { kind: 'gigApplication', gigId: after.gigId, applicationId: event.params.id },
      },
    ]);
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Solana RPC proxy
// ─────────────────────────────────────────────────────────────────────────
//
// Forwards Solana JSON-RPC calls to the Helius endpoint stored in
// HELIUS_RPC_URL (a Cloud Functions Secret). The client `Connection` is
// pointed at this function URL, so the API key never ships in the JS bundle.
//
// Why an HTTP function (not callable): @solana/web3.js's `Connection` POSTs
// raw JSON-RPC bodies; it doesn't speak the Firebase callable wrapping
// format. We forward verbatim and copy the response body + status.
//
// Cost guardrails: maxInstances limits concurrency-driven blow-up,
// concurrency lets a single instance handle many parallel requests
// (RPC calls are I/O-bound).
export const solanaRpcProxyMainnet = onRequest(
  {
    cors: true,
    secrets: [HELIUS_RPC_URL],
    maxInstances: 10,
    concurrency: 80,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }
    const upstream = HELIUS_RPC_URL.value();
    if (!upstream) {
      res.status(503).send('RPC endpoint not configured');
      return;
    }
    try {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const response = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const text = await response.text();
      res.status(response.status);
      res.set('Content-Type', response.headers.get('content-type') ?? 'application/json');
      res.send(text);
    } catch (err) {
      console.error('solanaRpcProxyMainnet error', err);
      res.status(502).send('RPC upstream failure');
    }
  },
);

export const solanaRpcProxyDevnet = onRequest(
  {
    cors: true,
    secrets: [HELIUS_RPC_URL_DEVNET],
    maxInstances: 10,
    concurrency: 80,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }
    const upstream = HELIUS_RPC_URL_DEVNET.value();
    if (!upstream) {
      res.status(503).send('RPC endpoint not configured');
      return;
    }
    try {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const response = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const text = await response.text();
      res.status(response.status);
      res.set('Content-Type', response.headers.get('content-type') ?? 'application/json');
      res.send(text);
    } catch (err) {
      console.error('solanaRpcProxyDevnet error', err);
      res.status(502).send('RPC upstream failure');
    }
  },
);

// Order status flips → ping the relevant counterparty.
export const notifyOrderStateChanged = onDocumentUpdated(
  'orders/{id}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    const orderId = event.params.id;
    const amount = fmtSol(after.amountSol);
    let recipientId = null;
    let title = null;
    let body = null;

    if (before.status === 'pending' && after.status === 'paid') {
      recipientId = after.sellerId;
      title = 'Payment received';
      body = `${amount} SOL hit your wallet.`;
    } else if (before.status === 'pending' && after.status === 'failed') {
      recipientId = after.buyerId;
      title = "Payment didn't go through";
      body = 'Open the order to see what happened.';
    } else if (before.status === 'paid' && after.status === 'delivered') {
      recipientId = after.buyerId;
      title = 'Marked delivered';
      body = 'The seller says it shipped — confirm receipt when ready.';
    } else if (before.status === 'delivered' && after.status === 'complete') {
      recipientId = after.sellerId;
      title = 'Order complete';
      body = 'The buyer confirmed receipt.';
    } else {
      return;
    }

    await bumpActivity(recipientId);
    await emitNotification({
      recipientId,
      kind: 'order_state',
      title,
      body,
      href: '/inbox/order_' + orderId,
      refs: { orderId },
    });
    const token = await pushTokenFor(recipientId);
    if (!token) return;
    await sendExpoPush([
      {
        to: token,
        sound: 'default',
        title,
        body,
        data: { kind: 'order', orderId },
      },
    ]);
  },
);

// New thread message → fan out metadata onto the parent thread doc:
// lastMessage*, counterparty unreadCount++. Clients only write the message
// (rules forbid them from touching these fields), so this trigger is the
// sole writer for them. Also emits one /notifications doc per
// counterparty so the web bell pings on new messages.
export const onMessageCreate = onDocumentCreated(
  'threads/{threadId}/messages/{messageId}',
  async (event) => {
    const message = event.data?.data();
    if (!message) return;
    const { threadId } = event.params;
    const senderId = message.senderId;
    const body = typeof message.body === 'string' ? message.body : '';
    const preview = body.slice(0, 120);

    const db = admin.firestore();
    const threadRef = db.collection('threads').doc(threadId);
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) return;
    const thread = threadSnap.data() || {};
    const participants = Array.isArray(thread.participants)
      ? thread.participants
      : [];
    const senderSnapshot =
      (thread.participantSnapshots &&
        thread.participantSnapshots[senderId]) ||
      {};
    const senderLabel =
      senderSnapshot.displayName ||
      (senderSnapshot.handle ? `@${senderSnapshot.handle}` : 'Someone');

    const update = {
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessagePreview: preview,
      lastMessageSenderId: senderId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    for (const uid of participants) {
      if (uid === senderId) {
        update[`unreadCount.${uid}`] = 0;
      } else {
        update[`unreadCount.${uid}`] = admin.firestore.FieldValue.increment(1);
      }
    }
    await threadRef.update(update);

    // Bell ping for the counterparty (or counterparties — generic over
    // participant count). Skip system messages, since those are
    // lifecycle markers the actor already triggered themselves.
    if (message.kind === 'system') return;
    for (const uid of participants) {
      if (uid === senderId) continue;
      await emitNotification({
        recipientId: uid,
        kind: 'thread_message',
        title: senderLabel,
        body: preview || 'Sent an attachment',
        href: '/inbox/' + threadId,
        refs: { threadId },
      });
    }
  },
);

// Dispute filed → ping the counterparty + every arbiter. The arbiter
// fan-out reads the small /roles collection (typically a handful of
// docs in v1) and emits one notification per arbiter.
export const notifyDisputeFiled = onDocumentCreated(
  'disputes/{id}',
  async (event) => {
    const dispute = event.data?.data();
    if (!dispute) return;
    const disputeId = event.params.id;
    const orderId = dispute.orderId;
    const filedBy = dispute.filedBy;
    const counterpartyId = filedBy === 'buyer' ? dispute.sellerId : dispute.buyerId;

    const reasonPreview = typeof dispute.reason === 'string'
      ? dispute.reason.slice(0, 200)
      : '';

    await bumpActivity(counterpartyId);
    await emitNotification({
      recipientId: counterpartyId,
      kind: 'dispute_filed',
      title: 'Dispute opened',
      body: reasonPreview || 'Adler will review the message log shortly.',
      href: '/inbox/order_' + orderId,
      refs: { disputeId, orderId, threadId: 'order_' + orderId },
    });

    // Arbiters: read the /roles collection. Tiny in v1 — no pagination.
    try {
      const arbiterSnap = await admin.firestore().collection('roles')
        .where('role', '==', 'arbiter').get();
      for (const doc of arbiterSnap.docs) {
        await emitNotification({
          recipientId: doc.id,
          kind: 'dispute_filed',
          title: 'Dispute opened',
          body: reasonPreview || 'Open the panel to review.',
          href: '/admin/disputes/' + disputeId,
          refs: { disputeId, orderId, threadId: 'order_' + orderId },
        });
      }
    } catch (err) {
      console.warn('notifyDisputeFiled arbiter fan-out failed', err);
    }
  },
);

// Dispute resolved → ping both parties with the outcome.
export const notifyDisputeResolved = onDocumentUpdated(
  'disputes/{id}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status !== 'open' || after.status !== 'resolved') return;

    const disputeId = event.params.id;
    const orderId = after.orderId;
    let outcomeLabel = 'Decided';
    if (after.outcome === 'release_to_creator') outcomeLabel = 'release to creator';
    else if (after.outcome === 'refund_to_brand') outcomeLabel = 'refund to brand';
    else if (after.outcome === 'split') {
      const pct = typeof after.splitPercentToCreator === 'number'
        ? Math.round(after.splitPercentToCreator) : 50;
      outcomeLabel = 'split (' + pct + '% to creator)';
    }
    const title = 'Dispute resolved — ' + outcomeLabel;
    const note = typeof after.outcomeNote === 'string'
      ? after.outcomeNote.slice(0, 200) : '';
    const body = note || 'See the order thread for the arbiter note.';

    for (const recipientId of [after.buyerId, after.sellerId]) {
      if (!recipientId) continue;
      await bumpActivity(recipientId);
      await emitNotification({
        recipientId,
        kind: 'dispute_resolved',
        title,
        body,
        href: '/inbox/order_' + orderId,
        refs: { disputeId, orderId, threadId: 'order_' + orderId },
      });
    }
  },
);


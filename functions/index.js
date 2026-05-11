import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { Buffer } from 'node:buffer';
import admin from 'firebase-admin';
import { verifyAccessToken } from '@privy-io/node';
import { createRemoteJWKSet } from 'jose';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IDL = JSON.parse(readFileSync(join(__dirname, 'idl.json'), 'utf-8'));

admin.initializeApp();

// ─── Secrets ─────────────────────────────────────────────────────────────

const PRIVY_APP_ID = defineSecret('PRIVY_APP_ID');
const PRIVY_APP_SECRET = defineSecret('PRIVY_APP_SECRET');
const HELIUS_RPC_URL_DEVNET = defineSecret('HELIUS_RPC_URL_DEVNET');
// Server-side keypair used as the permissionless `caller` for `refundBounty`
// on the scheduled-expiry sweep. Pays the tx fee; refund goes back to the
// poster regardless of who signs.
const REFUND_CALLER_KEYPAIR_BASE58 = defineSecret('VERIFIER_KEYPAIR_BASE58');
const SUPER_ADMIN_UID = defineSecret('SUPER_ADMIN_UID');

const PROGRAM_ID = new PublicKey('BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr');
const BOUNTY_ESCROW_SEED = Buffer.from('bounty');
const PROTOCOL_CONFIG_SEED = Buffer.from('bounty_config');
const REPORT_HIDE_THRESHOLD = 100;

// ─── JWKS / Privy auth ────────────────────────────────────────────────────

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

// ─── Push helpers ────────────────────────────────────────────────────────

async function sendExpoPush(messages) {
  const valid = messages.filter((m) => m && typeof m.to === 'string' && m.to.length > 0);
  if (valid.length === 0) return;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
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

async function emitNotification({ recipientId, kind, title, body, href, refs }) {
  if (!recipientId) return;
  try {
    await admin.firestore().collection('notifications').add({
      recipientId,
      kind,
      title,
      body,
      href: href ?? '/(home)/(tabs)/inbox',
      read: false,
      refs: refs ?? {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('emitNotification failed', err);
  }
}

async function notifyUser({ recipientId, title, body, kind, refs, href }) {
  await emitNotification({ recipientId, kind, title, body, refs, href });
  const token = await pushTokenFor(recipientId);
  if (!token) return;
  await sendExpoPush([
    {
      to: token,
      sound: 'default',
      title,
      body,
      data: { kind, refs: refs ?? {}, href: href ?? null },
    },
  ]);
  await bumpActivity(recipientId);
}

// ─── Solana / Anchor server-side setup ────────────────────────────────────

function bountyIdToBytes(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== 64) {
    throw new Error(`bounty contractIdHex must be 32 bytes (64 hex chars), got ${clean.length}`);
  }
  return Buffer.from(clean, 'hex');
}

function deriveBountyEscrowPda(posterPubkey, bountyIdBytes) {
  const [pda] = PublicKey.findProgramAddressSync(
    [BOUNTY_ESCROW_SEED, posterPubkey.toBuffer(), bountyIdBytes],
    PROGRAM_ID,
  );
  return pda;
}

function deriveProtocolConfigPda() {
  const [pda] = PublicKey.findProgramAddressSync([PROTOCOL_CONFIG_SEED], PROGRAM_ID);
  return pda;
}

let _refundCallerKeypair = null;
function loadRefundCallerKeypair(secretValue) {
  if (_refundCallerKeypair) return _refundCallerKeypair;
  const decoded = bs58.decode(secretValue);
  if (decoded.length !== 64) {
    throw new Error(`Refund caller secret must be 64 bytes, got ${decoded.length}`);
  }
  _refundCallerKeypair = Keypair.fromSecretKey(decoded);
  return _refundCallerKeypair;
}

function buildAnchorProgram(connection, signer) {
  const wallet = {
    publicKey: signer.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(signer);
      return tx;
    },
    signAllTransactions: async (txs) => txs.map((tx) => {
      tx.partialSign(signer);
      return tx;
    }),
  };
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  return new anchor.Program(IDL, provider);
}

// ─────────────────────────────────────────────────────────────────────────
// Auth bridge: Privy access token → Firebase custom token
// ─────────────────────────────────────────────────────────────────────────

export const mintFirebaseToken = onCall(
  { secrets: [PRIVY_APP_ID, PRIVY_APP_SECRET], cors: true },
  async (request) => {
    const accessToken = requireString(request.data?.accessToken, 'accessToken');
    const appId = PRIVY_APP_ID.value();
    const appSecret = PRIVY_APP_SECRET.value();

    let claims;
    try {
      claims = await verifyAccessToken({
        access_token: accessToken,
        app_id: appId,
        verification_key: getJwks(appId),
      });
    } catch (err) {
      console.warn('Privy access token verification failed', err);
      throw new HttpsError('unauthenticated', 'Invalid Privy access token');
    }

    const uid = claims.user_id;
    if (typeof uid !== 'string' || uid.length === 0) {
      throw new HttpsError('unauthenticated', 'Privy claims missing user_id');
    }

    const customToken = await admin.auth().createCustomToken(uid, {
      privy: { appId, sessionId: claims.session_id ?? null },
    });
    return { token: customToken, uid };
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Helius RPC proxy (devnet)
// ─────────────────────────────────────────────────────────────────────────

export const solanaRpcProxyDevnet = onRequest(
  { secrets: [HELIUS_RPC_URL_DEVNET], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('POST only');
      return;
    }
    try {
      const upstream = await fetch(HELIUS_RPC_URL_DEVNET.value(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const text = await upstream.text();
      res.status(upstream.status).type('application/json').send(text);
    } catch (err) {
      console.warn('RPC proxy failed', err);
      res.status(502).send('Upstream RPC error');
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Bounty: enforce per-(bounty,user) submission cap
// ─────────────────────────────────────────────────────────────────────────

export const enforceSubmissionCap = onDocumentCreated(
  'submissions/{submissionId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const submission = snap.data();
    const bountyId = submission?.bountyId;
    const submitterId = submission?.submitterId;
    if (!bountyId || !submitterId) return;

    const db = admin.firestore();
    const bountyRef = db.collection('bounties').doc(bountyId);

    // The gate (status, window) AND the side-effect (counter increment)
    // happen in a single Firestore transaction so they're atomic with the
    // poster's `startCancel` transaction. Exactly one wins; the other
    // retries on stale data.
    let outcome;
    try {
      outcome = await db.runTransaction(async (tx) => {
        const bountySnap = await tx.get(bountyRef);
        if (!bountySnap.exists) return 'no_bounty';
        const bounty = bountySnap.data();

        if (bounty.status !== 'open') return 'status_closed';

        const now = Date.now();
        const submissionEndsAt =
          typeof bounty.submissionEndsAt === 'number' ? bounty.submissionEndsAt : null;
        if (submissionEndsAt !== null && now > submissionEndsAt) {
          return 'window_closed';
        }

        tx.update(bountyRef, {
          submissionCount: admin.firestore.FieldValue.increment(1),
        });
        return 'accepted';
      });
    } catch (err) {
      console.warn(`submission cap tx for ${bountyId} failed`, err);
      outcome = 'error';
    }

    if (outcome === 'accepted') return;

    // Reject path — delete the offending submission and tell the
    // submitter why. The deterministic doc id `${bountyId}_${uid}` is the
    // first-line dup gate; if we got here it's a status or window
    // problem.
    await snap.ref.delete();
    const body =
      outcome === 'window_closed'
        ? 'The submission window for this bounty has ended.'
        : 'This bounty is no longer accepting submissions.';
    await emitNotification({
      recipientId: submitterId,
      kind: 'system',
      title: 'Submissions closed',
      body,
      href: `/(home)/bounty/${bountyId}`,
      refs: { bountyId },
    });
  },
);

// Mirror the counter on submission delete (the rule lets a submitter
// withdraw a submission before winning). Keeps `submissionCount == 0`
// truthful so the poster can cancel again afterwards.
export const decrementSubmissionCountOnDelete = onDocumentDeleted(
  'submissions/{submissionId}',
  async (event) => {
    const submission = event.data?.data();
    const bountyId = submission?.bountyId;
    if (!bountyId) return;
    const bountyRef = admin.firestore().collection('bounties').doc(bountyId);
    try {
      await bountyRef.update({
        submissionCount: admin.firestore.FieldValue.increment(-1),
      });
    } catch (err) {
      console.warn(`Decrement for ${bountyId} failed`, err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Bounty: report threshold → hide
// ─────────────────────────────────────────────────────────────────────────

export const enforceReportThreshold = onDocumentCreated(
  'reports/{reportId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const report = snap.data();
    const bountyId = report?.bountyId;
    if (!bountyId) return;

    const bountyRef = admin.firestore().collection('bounties').doc(bountyId);
    let postId = null;
    let crossed = false;
    await admin.firestore().runTransaction(async (tx) => {
      const fresh = await tx.get(bountyRef);
      if (!fresh.exists) return;
      const data = fresh.data();
      const newCount = (data.reportCount ?? 0) + 1;
      const update = { reportCount: newCount };
      if (newCount >= REPORT_HIDE_THRESHOLD && data.status === 'open') {
        update.status = 'hidden';
        update.hiddenAt = admin.firestore.FieldValue.serverTimestamp();
        crossed = true;
        postId = data.posterId;
      }
      tx.update(bountyRef, update);
    });

    if (crossed && postId) {
      await notifyUser({
        recipientId: postId,
        kind: 'bounty_hidden_by_reports',
        title: 'Bounty hidden',
        body: 'Your bounty was hidden after community reports. Adler will review it.',
        href: `/(home)/bounty/${bountyId}`,
        refs: { bountyId },
      });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Bounty: scheduled expiry → on-chain refund
// ─────────────────────────────────────────────────────────────────────────

async function refundOnChain({ bounty, callerKeypair, connection }) {
  const program = buildAnchorProgram(connection, callerKeypair);
  const posterPubkey = new PublicKey(bounty.posterWalletAddress);
  const bountyIdBytes = bountyIdToBytes(bounty.contractIdHex);
  const escrowPda = deriveBountyEscrowPda(posterPubkey, bountyIdBytes);
  const configPda = deriveProtocolConfigPda();

  return await program.methods
    .refundBounty(Array.from(bountyIdBytes))
    .accounts({
      config: configPda,
      escrow: escrowPda,
      poster: posterPubkey,
      caller: callerKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([callerKeypair])
    .rpc();
}

export const expireBounties = onSchedule(
  {
    schedule: 'every 1 hours',
    secrets: [REFUND_CALLER_KEYPAIR_BASE58, HELIUS_RPC_URL_DEVNET],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const now = Date.now();
    const db = admin.firestore();

    // Pass 1 — submission window closed: open → in_review.
    // The poster now has the 90-day review window to pick a winner.
    const closing = await db
      .collection('bounties')
      .where('status', '==', 'open')
      .where('submissionEndsAt', '<=', now)
      .limit(100)
      .get();
    for (const doc of closing.docs) {
      const bounty = doc.data();
      try {
        await doc.ref.update({
          status: 'in_review',
          submissionsClosedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await notifyUser({
          recipientId: bounty.posterId,
          kind: 'bounty_in_review',
          title: 'Pick a winner',
          body: 'Submissions are closed. You have 90 days to award the bounty.',
          href: `/(home)/bounty/${doc.id}`,
          refs: { bountyId: doc.id },
        });
      } catch (err) {
        console.warn(`Move-to-review for ${doc.id} failed`, err);
      }
    }

    // Pass 2 — review window expired: refund anyone still un-settled.
    // Includes `cancelling` so a poster-initiated cancel that crashed
    // between the on-chain ix and the Firestore finalise gets reconciled
    // here (refundOnChain will either succeed or report "account not
    // found" if the escrow is already closed — both flip to refunded).
    const expired = await db
      .collection('bounties')
      .where('status', 'in', ['open', 'in_review', 'cancelling'])
      .where('expiresAt', '<=', now)
      .limit(50)
      .get();
    if (expired.empty) return;

    const connection = new Connection(HELIUS_RPC_URL_DEVNET.value(), 'confirmed');
    const callerKeypair = loadRefundCallerKeypair(REFUND_CALLER_KEYPAIR_BASE58.value());

    for (const doc of expired.docs) {
      const bounty = doc.data();
      try {
        const sig = await refundOnChain({ bounty, callerKeypair, connection });
        await doc.ref.update({
          status: 'refunded',
          txSignature: sig,
          refundedAt: admin.firestore.FieldValue.serverTimestamp(),
          cancellingFromStatus: admin.firestore.FieldValue.delete(),
        });
        await notifyUser({
          recipientId: bounty.posterId,
          kind: 'bounty_expired_refund',
          title: 'Bounty refunded',
          body: 'No winner picked in the review window. Your SOL is back in your wallet.',
          href: `/(home)/bounty/${doc.id}`,
          refs: { bountyId: doc.id },
        });
      } catch (err) {
        // Escrow account already closed (poster successfully cancelled
        // on-chain but Firestore finalise didn't land) — reconcile to
        // `refunded` so we don't loop on this bounty forever.
        const msg = err instanceof Error ? err.message : String(err);
        if (/AccountNotInitialized|account.*does not exist|account.*not found/i.test(msg)) {
          await doc.ref.update({
            status: 'refunded',
            txSignature: bounty.txSignature ?? 'reconciled',
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            cancellingFromStatus: admin.firestore.FieldValue.delete(),
          });
        } else {
          console.warn(`Refund for ${doc.id} failed`, err);
        }
      }
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Bounty: notify poster when a submission lands
// ─────────────────────────────────────────────────────────────────────────

export const notifyBountySubmissionReceived = onDocumentCreated(
  'submissions/{submissionId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const submission = snap.data();
    const bountyId = submission?.bountyId;
    if (!bountyId) return;
    const bountySnap = await admin.firestore().collection('bounties').doc(bountyId).get();
    if (!bountySnap.exists) return;
    const bounty = bountySnap.data();
    if (bounty.posterId === submission.submitterId) return;
    await notifyUser({
      recipientId: bounty.posterId,
      kind: 'bounty_submission_received',
      title: 'New submission',
      body: 'Someone submitted to your bounty.',
      href: `/(home)/bounty/${bountyId}`,
      refs: { bountyId, submissionId: event.params.submissionId },
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Account deletion (cascade bounty data)
// ─────────────────────────────────────────────────────────────────────────

async function deletePrivyUser(uid, appId, appSecret) {
  const res = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
      'privy-app-id': appId,
    },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    console.warn(`Privy DELETE failed ${res.status}: ${body}`);
  }
}

export const deleteUserAccount = onCall(
  { secrets: [PRIVY_APP_ID, PRIVY_APP_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign-in required');

    const openBounties = await admin
      .firestore()
      .collection('bounties')
      .where('posterId', '==', uid)
      .where('status', '==', 'open')
      .get();
    const batch = admin.firestore().batch();
    openBounties.docs.forEach((d) =>
      batch.update(d.ref, {
        status: 'hidden',
        hiddenAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
    );
    await batch.commit();

    const profileRef = admin.firestore().collection('profiles').doc(uid);
    const profileSnap = await profileRef.get();
    if (profileSnap.exists) {
      const username = profileSnap.data()?.username;
      if (username) {
        await admin
          .firestore()
          .collection('usernames')
          .doc(username)
          .delete()
          .catch(() => {});
      }
      await profileRef.delete();
    }

    await admin.auth().deleteUser(uid).catch((err) => {
      console.warn('Firebase deleteUser failed', err);
    });
    try {
      await deletePrivyUser(uid, PRIVY_APP_ID.value(), PRIVY_APP_SECRET.value());
    } catch (err) {
      console.warn('Privy delete failed', err);
    }

    return { ok: true };
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Groups (nice-to-have): super-admin approves group creation;
// group-admin approves/rejects join requests.
// ─────────────────────────────────────────────────────────────────────────

function assertSuperAdmin(uid) {
  if (!uid || uid !== SUPER_ADMIN_UID.value()) {
    throw new HttpsError('permission-denied', 'Super-admin only');
  }
}

async function assertGroupAdmin(callerUid, groupId) {
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign-in required');
  const memberSnap = await admin
    .firestore()
    .collection('groupMembers')
    .doc(`${groupId}_${callerUid}`)
    .get();
  if (!memberSnap.exists || memberSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Group admin only');
  }
}

export const approveGroupCreation = onCall(
  { secrets: [SUPER_ADMIN_UID] },
  async (request) => {
    assertSuperAdmin(request.auth?.uid);
    const requestId = requireString(request.data?.requestId, 'requestId');
    const reqRef = admin.firestore().collection('groupCreationRequests').doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) throw new HttpsError('not-found', 'Request not found');
    const req = reqSnap.data();
    if (req.status !== 'pending') {
      throw new HttpsError('failed-precondition', `Request already ${req.status}`);
    }

    const groupRef = admin.firestore().collection('groups').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    await admin.firestore().runTransaction(async (tx) => {
      tx.set(groupRef, {
        id: groupRef.id,
        name: req.name,
        description: req.description,
        ownerId: req.requesterId,
        createdAt: now,
        status: 'active',
        memberCount: 1,
        openBountyTotalLamports: 0,
      });
      tx.set(
        admin.firestore().collection('groupMembers').doc(`${groupRef.id}_${req.requesterId}`),
        {
          groupId: groupRef.id,
          uid: req.requesterId,
          joinedAt: now,
          role: 'admin',
        },
      );
      tx.update(reqRef, { status: 'approved', approvedAt: now });
    });

    return { groupId: groupRef.id };
  },
);

export const approveJoinRequest = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const requestId = requireString(request.data?.requestId, 'requestId');
  const reqRef = admin.firestore().collection('joinRequests').doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError('not-found', 'Request not found');
  const req = reqSnap.data();
  await assertGroupAdmin(callerUid, req.groupId);
  if (req.status !== 'pending') {
    throw new HttpsError('failed-precondition', `Request already ${req.status}`);
  }
  const now = admin.firestore.FieldValue.serverTimestamp();
  await admin.firestore().runTransaction(async (tx) => {
    tx.update(reqRef, { status: 'approved', approvedAt: now });
    tx.set(
      admin.firestore().collection('groupMembers').doc(`${req.groupId}_${req.uid}`),
      { groupId: req.groupId, uid: req.uid, joinedAt: now, role: 'member' },
    );
    tx.update(admin.firestore().collection('groups').doc(req.groupId), {
      memberCount: admin.firestore.FieldValue.increment(1),
    });
  });

  await notifyUser({
    recipientId: req.uid,
    kind: 'group_join_approved',
    title: "You're in",
    body: 'Your group join request was approved.',
    href: `/(home)/group/${req.groupId}`,
    refs: { groupId: req.groupId },
  });
  return { ok: true };
});

export const rejectJoinRequest = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const requestId = requireString(request.data?.requestId, 'requestId');
  const reqRef = admin.firestore().collection('joinRequests').doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError('not-found', 'Request not found');
  const req = reqSnap.data();
  await assertGroupAdmin(callerUid, req.groupId);
  if (req.status !== 'pending') {
    throw new HttpsError('failed-precondition', `Request already ${req.status}`);
  }
  await reqRef.update({
    status: 'rejected',
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await notifyUser({
    recipientId: req.uid,
    kind: 'group_join_rejected',
    title: 'Group request declined',
    body: 'A group admin declined your join request.',
    href: `/(home)/group/${req.groupId}`,
    refs: { groupId: req.groupId },
  });
  return { ok: true };
});

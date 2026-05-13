import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
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
const BOUNTY_ESCROW_SEED = Buffer.from('bounty_v2');
const PROTOCOL_CONFIG_SEED = Buffer.from('bounty_config_v2');
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
  const privateSnap = await admin.firestore().collection('profilePrivate').doc(userId).get();
  if (privateSnap.exists) {
    return privateSnap.data()?.pushToken ?? null;
  }
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

// Default-on: missing preferences doc / missing key === enabled. Only an
// explicit `false` mutes the kind. Mirrors `DEFAULT_NOTIFICATION_PREFERENCES`
// on the client.
async function notificationKindEnabled(recipientId, kind) {
  if (!recipientId || !kind) return true;
  try {
    const snap = await admin
      .firestore()
      .collection('preferences')
      .doc(recipientId)
      .get();
    if (!snap.exists) return true;
    const value = snap.data()?.notifications?.[kind];
    return value !== false;
  } catch (err) {
    console.warn('notificationKindEnabled lookup failed', err);
    return true;
  }
}

async function notifyUser({ recipientId, title, body, kind, refs, href }) {
  if (!(await notificationKindEnabled(recipientId, kind))) return;
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
  { secrets: [PRIVY_APP_ID], cors: true },
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

// JSON-RPC methods the mobile app actually needs. Anything else gets
// rejected so the proxy can't be repurposed as a free Helius gateway.
const RPC_METHOD_ALLOWLIST = new Set([
  'getAccountInfo',
  'getBalance',
  'getBlockHeight',
  'getLatestBlockhash',
  'getMinimumBalanceForRentExemption',
  'getMultipleAccounts',
  'getProgramAccounts',
  'getRecentBlockhash',
  'getSignatureStatus',
  'getSignatureStatuses',
  'getSignaturesForAddress',
  'getSlot',
  'getTransaction',
  'sendTransaction',
  'sendRawTransaction',
  'simulateTransaction',
]);

// Daily per-IP cap on the proxy. Plenty of headroom for genuine clients;
// stops a single abuser from burning Helius credits.
const RPC_DAILY_QUOTA_PER_IP = 10000;

function clientIp(req) {
  const fwd = req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.ip || 'unknown';
}

function yyyymmdd() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function bumpRpcQuota(ip) {
  const key = `${ip.replace(/[^a-zA-Z0-9_.-]/g, '_')}_${yyyymmdd()}`;
  const ref = admin.firestore().collection('rpcQuota').doc(key);
  const result = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data()?.count ?? 0 : 0;
    if (current >= RPC_DAILY_QUOTA_PER_IP) return { allowed: false, count: current };
    tx.set(
      ref,
      {
        count: current + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { allowed: true, count: current + 1 };
  });
  return result;
}

export const solanaRpcProxyDevnet = onRequest(
  { secrets: [HELIUS_RPC_URL_DEVNET], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('POST only');
      return;
    }

    // Method allowlist (reject batch JSON-RPC too).
    const body = req.body;
    if (Array.isArray(body)) {
      res.status(400).send('Batch RPC not supported');
      return;
    }
    if (!body || typeof body.method !== 'string') {
      res.status(400).send('Missing JSON-RPC method');
      return;
    }
    if (!RPC_METHOD_ALLOWLIST.has(body.method)) {
      res.status(403).send(`Method '${body.method}' not allowed`);
      return;
    }

    // Per-IP daily quota.
    const ip = clientIp(req);
    try {
      const quota = await bumpRpcQuota(ip);
      if (!quota.allowed) {
        res.status(429).send('Daily quota exceeded');
        return;
      }
    } catch (err) {
      // Quota bookkeeping failed (Firestore down?). Fail open rather
      // than break the mobile app — method allowlist still gates the request.
      console.warn('RPC quota bump failed', err);
    }

    try {
      const upstream = await fetch(HELIUS_RPC_URL_DEVNET.value(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    // M8: floor at 0. A naive FieldValue.increment(-1) can drift
    // negative if delete-then-create races with parallel increments.
    try {
      await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(bountyRef);
        if (!snap.exists) return;
        const current = typeof snap.data()?.submissionCount === 'number'
          ? snap.data().submissionCount
          : 0;
        tx.update(bountyRef, {
          submissionCount: Math.max(0, current - 1),
        });
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

    // Pass 0 — Reconcile unfunded bounties (H5). Bounties with
    // `escrowFunded: false` older than 30 min are stuck: either the
    // on-chain `create_bounty` succeeded but `markEscrowFunded` didn't
    // land (escrow PDA exists), or the on-chain ix failed (no PDA).
    // Resolve by peeking at the on-chain state.
    const UNFUNDED_GRACE_MS = 30 * 60 * 1000;
    const unfundedThreshold = admin.firestore.Timestamp.fromMillis(
      now - UNFUNDED_GRACE_MS,
    );
    const unfunded = await db
      .collection('bounties')
      .where('escrowFunded', '==', false)
      .where('createdAt', '<=', unfundedThreshold)
      .limit(50)
      .get();
    if (!unfunded.empty) {
      const reconcileConn = new Connection(
        HELIUS_RPC_URL_DEVNET.value(),
        'confirmed',
      );
      for (const doc of unfunded.docs) {
        const bounty = doc.data();
        // Only reconcile pre-terminal docs. Settled / refunded / hidden
        // docs in escrowFunded:false state are someone else's problem.
        if (bounty.status !== 'open' && bounty.status !== 'in_review') continue;
        if (!bounty.posterWalletAddress || !bounty.contractIdHex) continue;
        try {
          const posterPubkey = new PublicKey(bounty.posterWalletAddress);
          const bountyIdBytes = bountyIdToBytes(bounty.contractIdHex);
          const escrowPda = deriveBountyEscrowPda(posterPubkey, bountyIdBytes);
          const accountInfo = await reconcileConn.getAccountInfo(escrowPda);
          if (accountInfo) {
            // PDA exists → on-chain create landed, just flip the flag.
            await doc.ref.update({ escrowFunded: true });
          } else {
            // No PDA → the bounty was never actually funded. Move to
            // terminal `refunded` with txSignature:null so the UI's
            // explorer-link check skips it.
            await doc.ref.update({
              status: 'refunded',
              txSignature: null,
              refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await notifyUser({
              recipientId: bounty.posterId,
              kind: 'bounty_expired_refund',
              title: 'Bounty cancelled',
              body: 'Funding never reached the escrow. The bounty was cancelled and no SOL was charged.',
              href: `/(home)/bounty/${doc.id}`,
              refs: { bountyId: doc.id },
            });
          }
        } catch (err) {
          console.warn(`Pass-0 reconcile for ${doc.id} failed`, err);
        }
      }
    }

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
          // M15: txSignature stays whatever was already on the doc; if
          // none, null (not the placeholder string 'reconciled' that
          // produced a 404 explorer link).
          await doc.ref.update({
            status: 'refunded',
            txSignature: bounty.txSignature ?? null,
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
// Bounty: notify winner + losers when poster settles manually
// ─────────────────────────────────────────────────────────────────────────

export const notifyBountySettled = onDocumentUpdated(
  'bounties/{bountyId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === 'settled' || after.status !== 'settled') return;
    const bountyId = event.params.bountyId;
    const winnerId = after.winnerId ?? null;
    if (!winnerId) return;

    const bountyHref = `/(home)/bounty/${bountyId}`;
    const title = after.title ?? 'a bounty';

    await notifyUser({
      recipientId: winnerId,
      kind: 'bounty_won',
      title: 'You won a bounty',
      body: `Your submission to “${title}” was awarded. Funds are in your wallet.`,
      href: bountyHref,
      refs: { bountyId, submissionId: after.winningSubmissionId ?? undefined },
    });

    // Fan out `bounty_lost` to every other submitter. Capped to a sane
    // batch — `MAX_SUBMISSIONS_PER_USER = 1` so doc count == loser count.
    try {
      const losers = await admin
        .firestore()
        .collection('submissions')
        .where('bountyId', '==', bountyId)
        .limit(500)
        .get();
      const seen = new Set();
      const sends = [];
      const batch = admin.firestore().batch();
      for (const doc of losers.docs) {
        const submitterId = doc.data()?.submitterId;
        batch.update(doc.ref, {
          bountyStatus: 'settled',
          isWinner: doc.id === after.winningSubmissionId || submitterId === winnerId,
        });
        if (!submitterId || submitterId === winnerId || seen.has(submitterId)) continue;
        seen.add(submitterId);
        sends.push(
          notifyUser({
            recipientId: submitterId,
            kind: 'bounty_lost',
            title: 'Bounty awarded',
            body: `“${title}” was awarded to another submission.`,
            href: bountyHref,
            refs: { bountyId },
          }),
        );
      }
      await batch.commit();
      await Promise.all(sends);
    } catch (err) {
      console.warn(`notifyBountySettled losers fan-out for ${bountyId} failed`, err);
    }
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

    // H6: block deletion if the user has non-terminal funded bounties.
    // After we delete the Privy user, embedded-wallet keys are gone —
    // refund/settle on those bounties becomes impossible. Surface a
    // failed-precondition so the client can show actionable copy
    // pointing the user at each bounty.
    const activeFunded = await admin
      .firestore()
      .collection('bounties')
      .where('posterId', '==', uid)
      .where('status', 'in', ['open', 'in_review', 'cancelling'])
      .where('escrowFunded', '==', true)
      .get();
    if (!activeFunded.empty) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot delete: ${activeFunded.size} active funded bounty${activeFunded.size === 1 ? '' : 's'}. Settle them, cancel them, or wait for refund.`,
      );
    }

    // Hide any unfunded `open` bounties — they have nothing on-chain so
    // it's safe to retire them.
    const openUnfunded = await admin
      .firestore()
      .collection('bounties')
      .where('posterId', '==', uid)
      .where('status', '==', 'open')
      .get();
    if (!openUnfunded.empty) {
      const batch = admin.firestore().batch();
      openUnfunded.docs.forEach((d) =>
        batch.update(d.ref, {
          status: 'hidden',
          hiddenAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      );
      await batch.commit();
    }

    // M9: Privy first, then Firebase. If Privy fails we abort — the
    // user is still signed-in and can retry. If Firebase fails AFTER
    // Privy succeeded, the user can no longer sign in via Privy
    // (terminal); admin can clean up the orphan via console.
    try {
      await deletePrivyUser(uid, PRIVY_APP_ID.value(), PRIVY_APP_SECRET.value());
    } catch (err) {
      console.warn('Privy delete failed', err);
      throw new HttpsError('internal', 'Account deletion failed at Privy step. Try again.');
    }

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

    return { ok: true };
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Groups (V2 admin-managed):
//   - Super-admin provisions groups (`createGroup`, `activateGroup`).
//   - Group-admin manages name/description (`updateGroup`) and members
//     (`addGroupMember`, `removeGroupMember`).
//   - No client self-service create / join — those flows were removed.
// ─────────────────────────────────────────────────────────────────────────

// H7: super-admin is a Firebase custom claim, not a secret-as-password.
// `auth.token.superAdmin === true` survives leaks of any single env var
// and lets us rotate the role without redeploying secrets.
function assertSuperAdmin(auth) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign-in required');
  }
  if (auth.token?.superAdmin !== true) {
    throw new HttpsError('permission-denied', 'Super-admin only');
  }
}

// One-time bootstrap: the user whose uid is in the SUPER_ADMIN_UID secret
// calls this once to seed the `superAdmin` custom claim on themselves
// (or another uid). After every super-admin has the claim, remove the
// secret and delete this function.
export const bootstrapSuperAdmin = onCall(
  { secrets: [SUPER_ADMIN_UID] },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError('unauthenticated', 'Sign-in required');
    if (callerUid !== SUPER_ADMIN_UID.value()) {
      throw new HttpsError('permission-denied', 'Not the bootstrap uid');
    }
    const targetUid = typeof request.data?.targetUid === 'string'
      ? request.data.targetUid
      : callerUid;
    const existing = (await admin.auth().getUser(targetUid)).customClaims ?? {};
    await admin.auth().setCustomUserClaims(targetUid, {
      ...existing,
      superAdmin: true,
    });
    return { ok: true, uid: targetUid };
  },
);

// Once one super-admin exists via the bootstrap path, any existing
// super-admin can grant the role to another uid. Drop the SUPER_ADMIN_UID
// secret after migration is complete.
export const grantSuperAdmin = onCall(async (request) => {
  assertSuperAdmin(request.auth);
  const targetUid = requireString(request.data?.targetUid, 'targetUid');
  const existing = (await admin.auth().getUser(targetUid)).customClaims ?? {};
  await admin.auth().setCustomUserClaims(targetUid, {
    ...existing,
    superAdmin: true,
  });
  return { ok: true, uid: targetUid };
});

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

// Privy uids in Adler are stored in DID form (`did:privy:c<24 chars>`).
// We accept either the bare CUID or the full DID as input — both normalise
// to the DID form before any Firestore lookup. Usernames are capped at 20
// chars by validation rules so the two namespaces don't overlap with CUIDs.
const PRIVY_BARE_CUID = /^c[a-z0-9]{24}$/i;
const PRIVY_DID = /^did:privy:c[a-z0-9]{24}$/i;

// Resolve "identifier" into a Privy uid (DID form). Accepts:
//   - a full Privy DID (`did:privy:c...`), used directly
//   - a bare CUID (`c...`), normalised by prepending `did:privy:`
//   - a username (case-insensitive, optionally prefixed with @), looked up
//     via the usernames/{slug} sentinel collection
async function resolveIdentifierToUid(identifier) {
  const trimmed = String(identifier ?? '').trim().replace(/^@/, '');
  if (!trimmed) throw new HttpsError('invalid-argument', 'identifier required');
  if (PRIVY_DID.test(trimmed)) return trimmed;
  if (PRIVY_BARE_CUID.test(trimmed)) return `did:privy:${trimmed}`;
  const slug = trimmed.toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(slug)) {
    throw new HttpsError('invalid-argument', 'Invalid username format');
  }
  const snap = await admin.firestore().collection('usernames').doc(slug).get();
  if (!snap.exists) throw new HttpsError('not-found', 'No user with that username');
  const uid = snap.data()?.userId;
  if (typeof uid !== 'string') {
    throw new HttpsError('internal', 'Username record is malformed');
  }
  return uid;
}

// updateGroup({ groupId, name?, description? })
//   Admin-only. Updates the editable fields. Skips no-op writes.
export const updateGroup = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const groupId = requireString(request.data?.groupId, 'groupId');
  await assertGroupAdmin(callerUid, groupId);

  const update = {};
  if (typeof request.data?.name === 'string') {
    const name = request.data.name.trim();
    if (name.length < 3 || name.length > 40) {
      throw new HttpsError('invalid-argument', 'Name must be 3–40 characters');
    }
    update.name = name;
  }
  if (typeof request.data?.description === 'string') {
    const description = request.data.description.trim();
    if (description.length > 500) {
      throw new HttpsError('invalid-argument', 'Description must be ≤ 500 characters');
    }
    update.description = description;
  }
  if (request.data?.logoUrl !== undefined) {
    const logoUrl = request.data.logoUrl;
    if (logoUrl === null || logoUrl === '') {
      // Clear the logo.
      update.logoUrl = admin.firestore.FieldValue.delete();
    } else if (typeof logoUrl === 'string') {
      // Validate the URL points at our Firebase Storage bucket AND lives
      // under the right per-group prefix. Stops an admin from binding an
      // arbitrary external image (or another group's logo) onto this doc.
      const expectedPathFragment = `/o/groupLogos%2F${groupId}%2F`;
      if (
        logoUrl.length > 2048 ||
        !logoUrl.startsWith('https://firebasestorage.googleapis.com/') ||
        !logoUrl.includes(expectedPathFragment)
      ) {
        throw new HttpsError(
          'invalid-argument',
          'logoUrl must be a Firebase Storage URL under this group\'s prefix',
        );
      }
      update.logoUrl = logoUrl;
    } else {
      throw new HttpsError('invalid-argument', 'logoUrl must be a string or null');
    }
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const groupRef = admin.firestore().collection('groups').doc(groupId);
  const snap = await groupRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Group not found');
  // Pending groups are still editable so super-admin can pre-populate
  // values before flipping to active.
  await groupRef.update({
    ...update,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// addGroupMember({ groupId, identifier })
//   Admin-only. Resolves username → uid, creates groupMembers doc, bumps
//   memberCount, sends a notification. Idempotent on already-member.
export const addGroupMember = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const groupId = requireString(request.data?.groupId, 'groupId');
  const identifier = requireString(request.data?.identifier, 'identifier');
  await assertGroupAdmin(callerUid, groupId);

  const targetUid = await resolveIdentifierToUid(identifier);
  const memberRef = admin
    .firestore()
    .collection('groupMembers')
    .doc(`${groupId}_${targetUid}`);
  const groupRef = admin.firestore().collection('groups').doc(groupId);

  const profileSnap = await admin.firestore().collection('profiles').doc(targetUid).get();
  if (!profileSnap.exists) {
    throw new HttpsError('not-found', 'User has no Adler profile yet');
  }
  const profile = profileSnap.data();
  const displayName =
    profile?.displayName || profile?.username || targetUid.slice(0, 6);

  let groupName = 'a group';
  await admin.firestore().runTransaction(async (tx) => {
    const memberSnap = await tx.get(memberRef);
    if (memberSnap.exists) {
      throw new HttpsError('already-exists', 'User is already a member');
    }
    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists) throw new HttpsError('not-found', 'Group not found');
    if (typeof groupSnap.data()?.name === 'string' && groupSnap.data().name.length > 0) {
      groupName = groupSnap.data().name;
    }
    tx.set(memberRef, {
      groupId,
      uid: targetUid,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      role: 'member',
    });
    tx.update(groupRef, {
      memberCount: admin.firestore.FieldValue.increment(1),
    });
  });

  await notifyUser({
    recipientId: targetUid,
    kind: 'group_member_added',
    title: 'Added to a group',
    body: `You were added to ${groupName}.`,
    href: `/(home)/group/${groupId}`,
    refs: { groupId },
  });

  return { uid: targetUid, displayName };
});

// removeGroupMember({ groupId, uid })
//   Admin-only. Self-removal allowed only if at least one other admin remains.
//   Decrements memberCount transactionally with a Math.max(0) floor.
export const removeGroupMember = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const groupId = requireString(request.data?.groupId, 'groupId');
  const targetUid = requireString(request.data?.uid, 'uid');
  await assertGroupAdmin(callerUid, groupId);

  const memberRef = admin
    .firestore()
    .collection('groupMembers')
    .doc(`${groupId}_${targetUid}`);
  const groupRef = admin.firestore().collection('groups').doc(groupId);

  await admin.firestore().runTransaction(async (tx) => {
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) {
      throw new HttpsError('not-found', 'Not a member');
    }
    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists) throw new HttpsError('not-found', 'Group not found');

    // Last-admin protection: if the target is an admin, ensure at least one
    // other admin remains. We can't query inside a transaction across
    // documents efficiently, so we read the admin list outside-then-check
    // here — for v1, the race is acceptable (worst case: group ends
    // adminless, super-admin can repair via createGroup-style ops).
    if (memberSnap.data()?.role === 'admin') {
      const otherAdmins = await admin
        .firestore()
        .collection('groupMembers')
        .where('groupId', '==', groupId)
        .where('role', '==', 'admin')
        .get();
      const remaining = otherAdmins.docs.filter((d) => d.id !== memberRef.id).length;
      if (remaining === 0) {
        throw new HttpsError(
          'failed-precondition',
          'Assign another admin before removing this one',
        );
      }
    }

    tx.delete(memberRef);
    const currentCount =
      typeof groupSnap.data()?.memberCount === 'number'
        ? groupSnap.data().memberCount
        : 0;
    tx.update(groupRef, {
      memberCount: Math.max(0, currentCount - 1),
    });
  });

  const groupData = (await groupRef.get()).data();
  await notifyUser({
    recipientId: targetUid,
    kind: 'group_member_removed',
    title: 'Removed from a group',
    body: `You were removed from ${groupData?.name ?? 'a group'}.`,
    refs: { groupId },
  });

  return { ok: true };
});

// createGroup({ name, description?, ownerId, status? })
//   Super-admin only. Provisions a new group + seeds ownerId as 'admin'.
//   Default status is 'pending' so the admin sees the "not ready" banner
//   until super-admin flips to 'active' via activateGroup.
export const createGroup = onCall(async (request) => {
  assertSuperAdmin(request.auth);
  const name = requireString(request.data?.name, 'name').trim();
  if (name.length < 3 || name.length > 40) {
    throw new HttpsError('invalid-argument', 'Name must be 3–40 characters');
  }
  const description =
    typeof request.data?.description === 'string'
      ? request.data.description.trim()
      : '';
  if (description.length > 500) {
    throw new HttpsError('invalid-argument', 'Description must be ≤ 500 characters');
  }
  const ownerId = requireString(request.data?.ownerId, 'ownerId');
  const status = request.data?.status === 'active' ? 'active' : 'pending';

  const profileSnap = await admin.firestore().collection('profiles').doc(ownerId).get();
  if (!profileSnap.exists) {
    throw new HttpsError('not-found', 'Owner has no Adler profile yet');
  }

  const groupRef = admin.firestore().collection('groups').doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  await admin.firestore().runTransaction(async (tx) => {
    tx.set(groupRef, {
      id: groupRef.id,
      name,
      description,
      ownerId,
      createdAt: now,
      status,
      memberCount: 1,
      openBountyTotalLamports: 0,
    });
    tx.set(
      admin.firestore().collection('groupMembers').doc(`${groupRef.id}_${ownerId}`),
      {
        groupId: groupRef.id,
        uid: ownerId,
        joinedAt: now,
        role: 'admin',
      },
    );
  });

  // Notify the new admin so they know to expect the group in their app.
  await notifyUser({
    recipientId: ownerId,
    kind: 'group_admin_assigned',
    title: status === 'active' ? "You're an admin" : 'You were assigned a group',
    body:
      status === 'active'
        ? `You're now admin of ${name}.`
        : `${name} is being set up. We'll let you know when it's ready.`,
    href: `/(home)/group/${groupRef.id}`,
    refs: { groupId: groupRef.id },
  });

  return { groupId: groupRef.id };
});

// activateGroup({ groupId })
//   Super-admin only. Flips status from 'pending' to 'active' once the
//   group is configured. Notifies the assigned admin.
export const activateGroup = onCall(async (request) => {
  assertSuperAdmin(request.auth);
  const groupId = requireString(request.data?.groupId, 'groupId');
  const groupRef = admin.firestore().collection('groups').doc(groupId);
  const snap = await groupRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Group not found');
  const group = snap.data();
  if (group.status === 'active') return { ok: true };
  await groupRef.update({
    status: 'active',
    activatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  if (group.ownerId) {
    await notifyUser({
      recipientId: group.ownerId,
      kind: 'group_activated',
      title: 'Your group is live',
      body: `${group.name ?? 'Your group'} is ready to manage.`,
      href: `/(home)/group/${groupId}`,
      refs: { groupId },
    });
  }
  return { ok: true };
});

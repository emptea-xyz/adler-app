import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { Buffer } from 'node:buffer';
import admin from 'firebase-admin';
import { verifyAccessToken } from '@privy-io/node';
import { createRemoteJWKSet } from 'jose';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
const VERIFIER_KEYPAIR_BASE58 = defineSecret('VERIFIER_KEYPAIR_BASE58');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const SUPER_ADMIN_UID = defineSecret('SUPER_ADMIN_UID');

const PROGRAM_ID = new PublicKey('BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr');
const BOUNTY_ESCROW_SEED = Buffer.from('bounty');
const PROTOCOL_CONFIG_SEED = Buffer.from('bounty_config');
const MAX_AUTO_SUBMISSIONS_PER_USER = 3;
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

let _verifierKeypair = null;
function loadVerifierKeypair(secretValue) {
  if (_verifierKeypair) return _verifierKeypair;
  const decoded = bs58.decode(secretValue);
  _verifierKeypair = Keypair.fromSecretKey(decoded);
  return _verifierKeypair;
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
      claims = await verifyAccessToken(accessToken, {
        appId,
        appSecret,
        jwks: getJwks(appId),
      });
    } catch (err) {
      console.warn('Privy access token verification failed', err);
      throw new HttpsError('unauthenticated', 'Invalid Privy access token');
    }

    const uid = claims.userId;
    if (typeof uid !== 'string' || uid.length === 0) {
      throw new HttpsError('unauthenticated', 'Privy claims missing userId');
    }

    const customToken = await admin.auth().createCustomToken(uid, {
      privy: { appId, sessionId: claims.sessionId ?? null },
    });
    return { customToken };
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
// Bounty: enforce per-(bounty,user) submission cap (auto mode)
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

    const bountySnap = await admin.firestore().collection('bounties').doc(bountyId).get();
    if (!bountySnap.exists) return;
    const bounty = bountySnap.data();
    if (bounty.mode !== 'auto') return;

    const existing = await admin
      .firestore()
      .collection('submissions')
      .where('bountyId', '==', bountyId)
      .where('submitterId', '==', submitterId)
      .get();
    if (existing.size <= MAX_AUTO_SUBMISSIONS_PER_USER) return;

    await snap.ref.delete();
    await emitNotification({
      recipientId: submitterId,
      kind: 'system',
      title: 'Submission cap reached',
      body: `You can submit at most ${MAX_AUTO_SUBMISSIONS_PER_USER} photos per auto bounty.`,
      href: `/(home)/bounty/${bountyId}`,
      refs: { bountyId },
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Bounty: verify submission + auto-settle on pass
// ─────────────────────────────────────────────────────────────────────────

async function fetchPhotoBytes(photoUrl) {
  const res = await fetch(photoUrl);
  if (!res.ok) throw new Error(`photo fetch HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function geminiVerify({ bountyPrompt, photoUrl, geminiKey }) {
  const photoBytes = await fetchPhotoBytes(photoUrl);
  const genai = new GoogleGenerativeAI(geminiKey);
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  const prompt = `You verify whether a photo satisfies a bounty prompt. Reply with strict JSON only, no prose: {"verdict":"pass"|"fail","confidence":0..1,"reasoning":"..."}. Bounty prompt: ${bountyPrompt}`;
  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: photoBytes.toString('base64'),
      },
    },
  ]);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    verdict: parsed.verdict === 'pass' ? 'pass' : 'fail',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 200) : '',
  };
}

async function settleAutoOnChain({ bounty, winnerWalletAddress, verifierKeypair, connection }) {
  const program = buildAnchorProgram(connection, verifierKeypair);
  const posterPubkey = new PublicKey(bounty.posterWalletAddress);
  const winnerPubkey = new PublicKey(winnerWalletAddress);
  const bountyIdBytes = bountyIdToBytes(bounty.contractIdHex);
  const escrowPda = deriveBountyEscrowPda(posterPubkey, bountyIdBytes);
  const configPda = deriveProtocolConfigPda();
  const config = await program.account.protocolConfig.fetch(configPda);

  return await program.methods
    .settleAutoBounty(Array.from(bountyIdBytes))
    .accounts({
      config: configPda,
      escrow: escrowPda,
      poster: posterPubkey,
      verifier: verifierKeypair.publicKey,
      winner: winnerPubkey,
      feeTreasury: config.feeTreasury,
      systemProgram: SystemProgram.programId,
    })
    .signers([verifierKeypair])
    .rpc();
}

export const verifyBountySubmission = onDocumentCreated(
  {
    document: 'submissions/{submissionId}',
    secrets: [VERIFIER_KEYPAIR_BASE58, GEMINI_API_KEY, HELIUS_RPC_URL_DEVNET],
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const submission = snap.data();
    const submissionId = event.params.submissionId;
    const bountyId = submission?.bountyId;
    if (!bountyId) return;

    const bountyRef = admin.firestore().collection('bounties').doc(bountyId);
    const bountySnap = await bountyRef.get();
    if (!bountySnap.exists) return;
    const bounty = bountySnap.data();
    if (bounty.status !== 'open') return;

    const submitterProfileSnap = await admin
      .firestore()
      .collection('profiles')
      .doc(submission.submitterId)
      .get();
    const winnerWalletAddress = submitterProfileSnap.exists
      ? submitterProfileSnap.data()?.walletAddress
      : null;

    let verdict = { verdict: 'fail', confidence: 0, reasoning: 'verifier error' };
    try {
      verdict = await geminiVerify({
        bountyPrompt: bounty.prompt,
        photoUrl: submission.photoUrl,
        geminiKey: GEMINI_API_KEY.value(),
      });
    } catch (err) {
      console.warn('Gemini verify failed', err);
      verdict = {
        verdict: 'fail',
        confidence: 0,
        reasoning: `verifier error: ${err.message?.slice(0, 100) ?? 'unknown'}`,
      };
    }

    const updates = {
      aiVerdict: verdict.verdict,
      aiConfidence: verdict.confidence,
      aiReasoning: verdict.reasoning,
    };

    if (bounty.mode === 'auto' && verdict.verdict === 'pass' && winnerWalletAddress) {
      try {
        const connection = new Connection(HELIUS_RPC_URL_DEVNET.value(), 'confirmed');
        const verifierKeypair = loadVerifierKeypair(VERIFIER_KEYPAIR_BASE58.value());
        const sig = await settleAutoOnChain({
          bounty,
          winnerWalletAddress,
          verifierKeypair,
          connection,
        });

        await admin.firestore().runTransaction(async (tx) => {
          const fresh = await tx.get(bountyRef);
          if (!fresh.exists) return;
          if (fresh.data().status !== 'open') return;
          tx.update(bountyRef, {
            status: 'settled',
            winnerId: submission.submitterId,
            winningSubmissionId: submissionId,
            txSignature: sig,
            settledAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          tx.update(snap.ref, { ...updates, isWinner: true });
        });

        await notifyUser({
          recipientId: submission.submitterId,
          kind: 'bounty_won',
          title: 'You won a bounty',
          body: `${(bounty.bountyLamports / 1e9).toFixed(3)} SOL is in your wallet.`,
          href: `/(home)/bounty/${bountyId}`,
          refs: { bountyId, submissionId },
        });
        return;
      } catch (err) {
        console.warn('Auto-settle on-chain failed', err);
        updates.aiReasoning = `${updates.aiReasoning} | settle err: ${err.message?.slice(0, 80) ?? ''}`;
      }
    }

    await snap.ref.update(updates);

    if (bounty.mode === 'auto' && verdict.verdict === 'fail') {
      await notifyUser({
        recipientId: submission.submitterId,
        kind: 'bounty_lost',
        title: 'Submission rejected',
        body: verdict.reasoning || 'The verifier said this photo did not match the prompt.',
        href: `/(home)/bounty/${bountyId}`,
        refs: { bountyId, submissionId },
      });
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

async function refundOnChain({ bounty, verifierKeypair, connection }) {
  const program = buildAnchorProgram(connection, verifierKeypair);
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
      caller: verifierKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([verifierKeypair])
    .rpc();
}

export const expireBounties = onSchedule(
  {
    schedule: 'every 1 hours',
    secrets: [VERIFIER_KEYPAIR_BASE58, HELIUS_RPC_URL_DEVNET],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const now = Date.now();
    const expired = await admin
      .firestore()
      .collection('bounties')
      .where('status', '==', 'open')
      .where('expiresAt', '<=', now)
      .limit(50)
      .get();
    if (expired.empty) return;

    const connection = new Connection(HELIUS_RPC_URL_DEVNET.value(), 'confirmed');
    const verifierKeypair = loadVerifierKeypair(VERIFIER_KEYPAIR_BASE58.value());

    for (const doc of expired.docs) {
      const bounty = doc.data();
      try {
        const sig = await refundOnChain({ bounty, verifierKeypair, connection });
        await doc.ref.update({
          status: 'refunded',
          txSignature: sig,
          refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await notifyUser({
          recipientId: bounty.posterId,
          kind: 'bounty_expired_refund',
          title: 'Bounty refunded',
          body: 'No winning submission within 30 days. Your SOL is back in your wallet.',
          href: `/(home)/bounty/${doc.id}`,
          refs: { bountyId: doc.id },
        });
      } catch (err) {
        console.warn(`Refund for ${doc.id} failed`, err);
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

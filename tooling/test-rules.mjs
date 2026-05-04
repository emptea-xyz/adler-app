// One-shot smoke test for `firestore.rules` against the local Firestore
// emulator. Validates that the profile-setup mutations introduced by the
// adler-website /settings/profile forms (commit 5ae1fa7) are accepted, and
// that obvious abuse paths are rejected.
//
// Usage:
//   firebase emulators:exec --only firestore "node tooling/test-rules.mjs"
//
// Exits 0 on green, non-zero on any failure.

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, "..", "firestore.rules");

const PROJECT_ID = "demo-adler-rules-test";
const ALICE = "alice";
const BOB = "bob";

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${label}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${label}`);
    console.error(`     ${err?.message ?? err}`);
  }
}

const env = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: readFileSync(RULES_PATH, "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

// Seed two profiles via the rules-bypass admin context. Mirrors what
// `ensureProfileExists` produces in the real client.
async function seed() {
  await env.withSecurityRulesDisabled(async (admin) => {
    const adminDb = admin.firestore();
    const baseDoc = (uid, username) => ({
      username,
      displayName: `${username[0].toUpperCase()}${username.slice(1)}`,
      bio: "",
      avatarUrl: null,
      walletAddress: null,
      pushToken: null,
      country: null,
      creatorProfile: null,
      brandProfile: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, "profiles", ALICE), baseDoc(ALICE, "aliceuser"));
    await setDoc(doc(adminDb, "profiles", BOB), baseDoc(BOB, "bobuser"));
  });
}

await seed();

const aliceDb = env.authenticatedContext(ALICE).firestore();
const aliceRef = doc(aliceDb, "profiles", ALICE);
const bobDbAsAlice = doc(aliceDb, "profiles", BOB);

console.log("\nProfile basics — accepts");
await check("displayName edit", () =>
  assertSucceeds(updateDoc(aliceRef, { displayName: "Alice Renamed", updatedAt: serverTimestamp() })),
);
await check("bio edit", () =>
  assertSucceeds(updateDoc(aliceRef, { bio: "Hello world", updatedAt: serverTimestamp() })),
);
await check("displayName + bio combined", () =>
  assertSucceeds(
    updateDoc(aliceRef, {
      displayName: "Alice Two",
      bio: "Combined edit",
      updatedAt: serverTimestamp(),
    }),
  ),
);

console.log("\nCountry — accepts + rejects");
await check("country = 'CH'", () =>
  assertSucceeds(updateDoc(aliceRef, { country: "CH", updatedAt: serverTimestamp() })),
);
await check("country = null (back to Global)", () =>
  assertSucceeds(updateDoc(aliceRef, { country: null, updatedAt: serverTimestamp() })),
);
await check("country = 'ch' (lowercase) rejected", () =>
  assertFails(updateDoc(aliceRef, { country: "ch", updatedAt: serverTimestamp() })),
);
await check("country = 'ZZZ' (3 letters) rejected", () =>
  assertFails(updateDoc(aliceRef, { country: "ZZZ", updatedAt: serverTimestamp() })),
);
await check("country = 'deutschland' rejected", () =>
  assertFails(updateDoc(aliceRef, { country: "deutschland", updatedAt: serverTimestamp() })),
);

console.log("\nCreator profile — accepts + rejects");
await check("creatorProfile with niches + portfolioUrl", () =>
  assertSucceeds(
    updateDoc(aliceRef, {
      creatorProfile: {
        niches: ["fashion", "tech"],
        portfolioUrl: "https://alice.example.com",
      },
      updatedAt: serverTimestamp(),
    }),
  ),
);
await check("creatorProfile with empty niches", () =>
  assertSucceeds(
    updateDoc(aliceRef, {
      creatorProfile: { niches: [], portfolioUrl: null },
      updatedAt: serverTimestamp(),
    }),
  ),
);
await check("creatorProfile = null (remove)", () =>
  assertSucceeds(updateDoc(aliceRef, { creatorProfile: null, updatedAt: serverTimestamp() })),
);
await check("creatorProfile with 7 niches rejected", () =>
  assertFails(
    updateDoc(aliceRef, {
      creatorProfile: {
        niches: ["a", "b", "c", "d", "e", "f", "g"],
        portfolioUrl: null,
      },
      updatedAt: serverTimestamp(),
    }),
  ),
);
await check("creatorProfile with extra key rejected", () =>
  assertFails(
    updateDoc(aliceRef, {
      creatorProfile: {
        niches: ["fashion"],
        portfolioUrl: null,
        secret: "no",
      },
      updatedAt: serverTimestamp(),
    }),
  ),
);
await check("creatorProfile with non-list niches rejected", () =>
  assertFails(
    updateDoc(aliceRef, {
      creatorProfile: { niches: "fashion", portfolioUrl: null },
      updatedAt: serverTimestamp(),
    }),
  ),
);

console.log("\nBrand profile — accepts + rejects");
await check("brandProfile with companyName only", () =>
  assertSucceeds(
    updateDoc(aliceRef, {
      brandProfile: {
        companyName: "Acme",
        industry: null,
        websiteUrl: null,
      },
      updatedAt: serverTimestamp(),
    }),
  ),
);
await check("brandProfile full", () =>
  assertSucceeds(
    updateDoc(aliceRef, {
      brandProfile: {
        companyName: "Acme Inc.",
        industry: "Beauty",
        websiteUrl: "https://acme.example.com",
      },
      updatedAt: serverTimestamp(),
    }),
  ),
);
await check("brandProfile = null (remove)", () =>
  assertSucceeds(updateDoc(aliceRef, { brandProfile: null, updatedAt: serverTimestamp() })),
);
await check("brandProfile with empty companyName rejected", () =>
  assertFails(
    updateDoc(aliceRef, {
      brandProfile: {
        companyName: "",
        industry: null,
        websiteUrl: null,
      },
      updatedAt: serverTimestamp(),
    }),
  ),
);
await check("brandProfile with extra key rejected", () =>
  assertFails(
    updateDoc(aliceRef, {
      brandProfile: {
        companyName: "Acme",
        industry: null,
        websiteUrl: null,
        secret: "no",
      },
      updatedAt: serverTimestamp(),
    }),
  ),
);
await check("brandProfile with non-string companyName rejected", () =>
  assertFails(
    updateDoc(aliceRef, {
      brandProfile: {
        companyName: 42,
        industry: null,
        websiteUrl: null,
      },
      updatedAt: serverTimestamp(),
    }),
  ),
);

console.log("\nUnknown fields and cross-user attacks");
await check("random extra field rejected", () =>
  assertFails(updateDoc(aliceRef, { foo: "bar", updatedAt: serverTimestamp() })),
);
await check("alice cannot edit bob's profile", () =>
  assertFails(updateDoc(bobDbAsAlice, { bio: "hax", updatedAt: serverTimestamp() })),
);

console.log("\nLegacy `role` field still accepted (mobile-app back-compat)");
await check("role = 'creator' still accepted", () =>
  assertSucceeds(updateDoc(aliceRef, { role: "creator", updatedAt: serverTimestamp() })),
);
await check("role = 'invalid' rejected", () =>
  assertFails(updateDoc(aliceRef, { role: "invalid", updatedAt: serverTimestamp() })),
);

await env.cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

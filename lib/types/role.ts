// Mirror of adler-website/lib/types/role.ts. Source of truth: the
// `match /roles/{uid}` block in adler-app/firestore.rules.
//
// Public-readable so both rules and clients can do a single
// `exists()`/`getDoc()` check; writes are admin-only — provision arbiters
// via firebase-cli (`firebase firestore:set roles/<uid> '{"role":"arbiter"}'`).

export type RoleName = "arbiter";

export interface Role {
  uid: string;
  role: RoleName;
  createdAt: number;
}

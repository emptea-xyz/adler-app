// Stub. Arbiter UI is out of scope for mobile (per plan §"Open decisions");
// only the read-side `getRole` is needed for guarding any future arbiter
// affordance.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Role } from '@/lib/types/role';

const COLLECTION = 'roles';

export async function getRole(uid: string): Promise<Role | null> {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        uid,
        role: data.role,
        createdAt: data.createdAt?.toMillis?.() ?? 0,
    };
}

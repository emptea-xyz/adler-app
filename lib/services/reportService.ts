import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';

const REPORTS = 'reports';

export async function reportBounty(bountyId: string, reason: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    const id = `${bountyId}_${uid}`;
    const ref = doc(db, REPORTS, id);
    // Idempotent: rule denies re-create, but we still short-circuit client-side.
    const existing = await getDoc(ref);
    if (existing.exists()) return;
    await setDoc(ref, {
        bountyId,
        reporterId: uid,
        reason: reason.trim().slice(0, 200),
        createdAt: serverTimestamp(),
    });
}

export async function hasReported(bountyId: string, uid: string): Promise<boolean> {
    const id = `${bountyId}_${uid}`;
    const snap = await getDoc(doc(db, REPORTS, id));
    return snap.exists();
}

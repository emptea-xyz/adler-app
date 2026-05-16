import { auth } from '@/lib/firebase/config';

export function requireAuth(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    return uid;
}

export function requireAuthAs(userId: string): string {
    const uid = auth.currentUser?.uid;
    if (!uid || uid !== userId) {
        throw new Error('Profile mutation requires authentication');
    }
    return uid;
}

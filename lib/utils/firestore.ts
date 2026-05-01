import { Timestamp } from 'firebase/firestore';

export const mapTimestamp = (ts: any): string => {
    if (ts instanceof Timestamp) return ts.toDate().toISOString();
    if (ts && typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (typeof ts === 'string') return ts;
    return '';
};

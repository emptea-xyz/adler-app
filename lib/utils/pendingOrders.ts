import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';

export interface PendingOrderBreadcrumb {
    orderId: string;
    escrowPda: string;
    signature: string | null;
    createdAt: number;
}

type PendingOrdersMap = Record<string, PendingOrderBreadcrumb>;

async function readMap(): Promise<PendingOrdersMap> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_ORDERS);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as PendingOrdersMap;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

async function writeMap(value: PendingOrdersMap): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ORDERS, JSON.stringify(value));
}

export async function listPendingOrders(): Promise<PendingOrderBreadcrumb[]> {
    const map = await readMap();
    return Object.values(map).sort((a, b) => a.createdAt - b.createdAt);
}

export async function setPendingOrder(
    orderId: string,
    patch: Omit<PendingOrderBreadcrumb, 'orderId'>,
): Promise<void> {
    const map = await readMap();
    map[orderId] = { orderId, ...patch };
    await writeMap(map);
}

export async function clearPendingOrder(orderId: string): Promise<void> {
    const map = await readMap();
    delete map[orderId];
    await writeMap(map);
}

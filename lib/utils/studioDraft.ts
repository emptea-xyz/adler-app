import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/lib/constants/storageKeys';
import type { ListingOverlay } from '@/lib/types/listing';

export interface StudioDraft {
    uri: string;
    contentType: string;
    durationMs: number;
    width: number;
    height: number;
    sizeBytes: number;
    overlay: ListingOverlay | null;
    trim?: {
        sourceUri: string;
        startTime: number;
        endTime: number;
    } | null;
    updatedAt: number;
}

export async function saveStudioDraft(draft: StudioDraft): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.STUDIO_DRAFT, JSON.stringify(draft));
}

export async function readStudioDraft(): Promise<StudioDraft | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.STUDIO_DRAFT);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<StudioDraft>;
        if (!parsed.uri || !parsed.contentType) return null;
        return {
            uri: parsed.uri,
            contentType: parsed.contentType,
            durationMs: Number(parsed.durationMs ?? 0),
            width: Number(parsed.width ?? 0),
            height: Number(parsed.height ?? 0),
            sizeBytes: Number(parsed.sizeBytes ?? 0),
            overlay: parsed.overlay ?? null,
            trim: parsed.trim ?? null,
            updatedAt: Number(parsed.updatedAt ?? 0),
        };
    } catch {
        return null;
    }
}

export async function clearStudioDraft(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.STUDIO_DRAFT);
}

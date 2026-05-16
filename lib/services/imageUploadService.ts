// Avatar pipeline + generic media-picker helpers. Listing / message
// attachments live in their own modules:
//   lib/services/listingMediaUploadService.ts
//   lib/services/messageMediaUploadService.ts
//
// `pickImage` and `pickImages` are kept here because they're generic
// (any feature picks images) and were already used by the legacy CreateSheet
// path. The legacy `uploadMarketplaceMedia` / `deleteMarketplaceMedia`
// functions wrote under `packages/{uid}/...`, which the v1 storage rules
// reject. They're gone — consumers should call `uploadListingMedia` from
// `listingMediaUploadService` instead.

import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { compressImageForUpload as compressImage, uriToBlob } from '@/lib/utils/mediaUpload';
import { requireAuth } from '@/lib/utils/requireAuth';

async function ensureMediaLibraryPermission(): Promise<void> {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted) return;
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!requested.granted) {
        throw new Error('Photo library access is denied. Enable it in Settings to add photos.');
    }
}

export async function pickImage(opts?: { aspect?: [number, number]; quality?: number }): Promise<string | null> {
    await ensureMediaLibraryPermission();

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: !!opts?.aspect,
        aspect: opts?.aspect,
        quality: opts?.quality ?? 0.8,
    });

    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
}

/**
 * Multi-image variant. Surfaces the system multi-select picker when
 * supported; falls back to a single asset on platforms / picker versions
 * that ignore `allowsMultipleSelection`.
 */
export async function pickImages(opts?: { selectionLimit?: number; quality?: number }): Promise<string[]> {
    await ensureMediaLibraryPermission();

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: opts?.selectionLimit,
        quality: opts?.quality ?? 0.8,
    });

    if (result.canceled || !result.assets?.length) return [];
    return result.assets.map((a) => a.uri);
}

/**
 * Upload an avatar to `profilePictures/{uid}.jpg`. Resizes to ≤ 400 px on
 * the longest edge and re-encodes JPEG before upload to stay under the
 * 2 MB storage-rule cap.
 */
export async function uploadProfilePicture(localUri: string): Promise<string> {
    const uid = requireAuth();
    const compressedUri = await compressImage(localUri, 400);
    const blob = await uriToBlob(compressedUri);
    const storageRef = ref(storage, `profilePictures/${uid}.jpg`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
}

/**
 * Compress a local image URI (no upload) and return the new local URI.
 * Useful for callers that want to feed the result into a different
 * storage service (e.g. listingMediaUploadService).
 */
export async function compressImageForUpload(localUri: string, maxDim = 1600): Promise<string> {
    return compressImage(localUri, maxDim);
}

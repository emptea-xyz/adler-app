import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase/config';

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
 * Multi-image variant. Surfaces the system multi-select picker when supported.
 * Falls back to a single asset on platforms / picker versions that ignore
 * `allowsMultipleSelection`.
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

async function compressImage(uri: string, maxDim = 1200): Promise<string> {
    const context = ImageManipulator.ImageManipulator.manipulate(uri)
        .resize({ width: maxDim });
    const imageRef = await context.renderAsync();
    const result = await imageRef.saveAsync({ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
    return result.uri;
}

function uriToBlob(uri: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Failed to convert URI to blob'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
    });
}

function requireUid(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    return uid;
}

export async function uploadProfilePicture(localUri: string): Promise<string> {
    const uid = requireUid();
    const compressedUri = await compressImage(localUri, 400);
    const blob = await uriToBlob(compressedUri);
    const storageRef = ref(storage, `profilePictures/${uid}.jpg`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
}

/**
 * Upload arbitrary marketplace media (package or gig assets) to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadMarketplaceMedia(
    localUri: string,
    folder: 'packages' | 'gigs' | 'applications',
    fileId: string,
): Promise<string> {
    const uid = requireUid();
    const compressedUri = await compressImage(localUri, 1600);
    const blob = await uriToBlob(compressedUri);
    const storageRef = ref(storage, `${folder}/${uid}/${fileId}.jpg`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
}

export async function deleteMarketplaceMedia(
    folder: 'packages' | 'gigs' | 'applications',
    fileId: string,
): Promise<void> {
    const uid = requireUid();
    const storageRef = ref(storage, `${folder}/${uid}/${fileId}.jpg`);
    try {
        await deleteObject(storageRef);
    } catch {
        // Best-effort cleanup — swallow not-found and permission errors.
    }
}

import {
    deleteObject,
    getDownloadURL,
    ref,
    uploadBytes,
} from 'firebase/storage';
import * as Crypto from 'expo-crypto';
import { storage } from '@/lib/firebase/config';
import type { ListingKind } from '@/lib/types/listing';

// Mirrored from ../adler-app/storage.rules — keep in lockstep. The 50 MB
// per-file cap and the content-type whitelist are both enforced server-
// side too; validating client-side just lets us fail fast with a friendly
// toast.
export const LISTING_MEDIA_MAX_BYTES = 50 * 1024 * 1024;
export const LISTING_MEDIA_MAX_PER_LISTING = 5;

const ALLOWED_CONTENT_TYPES = new Set<string>([
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
]);

const EXTENSION_FOR: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
};

export type ListingMediaKind = 'image' | 'video';

export interface UploadedListingMedia {
    url: string;
    path: string;
    contentType: string;
    kind: ListingMediaKind;
}

export function classifyListingMedia(contentType: string): ListingMediaKind | null {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    return null;
}

export class ListingMediaError extends Error {
    constructor(
        public readonly code: 'type' | 'size' | 'upload',
        message: string,
    ) {
        super(message);
        this.name = 'ListingMediaError';
    }
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

function pathFor(kind: ListingKind, uid: string, id: string, ext: string): string {
    const bucket = kind === 'service' ? 'services' : 'gigs';
    return `${bucket}/${uid}/${id}.${ext}`;
}

export interface UploadListingMediaInput {
    /** 'service' for creator listings, 'gig' for brand briefs. */
    kind: ListingKind;
    /** Owner uid — must match the storage-rule prefix and request.auth.uid. */
    uid: string;
    /** Local URI from expo-image-picker. */
    uri: string;
    /** MIME from the picker asset (e.g. `assets[i].mimeType`). */
    contentType: string;
    /** Bytes — picker exposes this on `assets[i].fileSize`. Optional but recommended. */
    sizeBytes?: number;
}

export async function uploadListingMedia(
    input: UploadListingMediaInput,
): Promise<UploadedListingMedia> {
    if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) {
        throw new ListingMediaError(
            'type',
            `Unsupported file type (${input.contentType || 'unknown'}). Use JPG, PNG, WEBP, MP4, WEBM, or MOV.`,
        );
    }
    if (input.sizeBytes !== undefined && input.sizeBytes > LISTING_MEDIA_MAX_BYTES) {
        throw new ListingMediaError(
            'size',
            `File is too large (${(input.sizeBytes / (1024 * 1024)).toFixed(1)} MB). Max ${LISTING_MEDIA_MAX_BYTES / (1024 * 1024)} MB.`,
        );
    }

    const ext = EXTENSION_FOR[input.contentType];
    const id = Crypto.randomUUID();
    const storagePath = pathFor(input.kind, input.uid, id, ext);
    const objectRef = ref(storage, storagePath);

    try {
        const blob = await uriToBlob(input.uri);
        await uploadBytes(objectRef, blob, { contentType: input.contentType });
        const url = await getDownloadURL(objectRef);
        return {
            url,
            path: storagePath,
            contentType: input.contentType,
            kind: classifyListingMedia(input.contentType) ?? 'image',
        };
    } catch (err) {
        throw new ListingMediaError(
            'upload',
            err instanceof Error ? err.message : 'Upload failed',
        );
    }
}

export async function deleteListingMedia(path: string): Promise<void> {
    const objectRef = ref(storage, path);
    try {
        await deleteObject(objectRef);
    } catch (err: unknown) {
        if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code: string }).code === 'storage/object-not-found'
        ) {
            return;
        }
        throw err;
    }
}

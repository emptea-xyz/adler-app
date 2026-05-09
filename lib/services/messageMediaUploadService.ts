import {
    getDownloadURL,
    ref,
    uploadBytes,
} from 'firebase/storage';
import * as Crypto from 'expo-crypto';
import { storage } from '@/lib/firebase/config';

// Mirrored from ../adler-app/storage.rules — keep in lockstep. Cap is 25 MB
// per file (deliverables tend to be short clips); content-type allowlist
// matches listing media. The Firestore rule on the messages subcollection
// caps `attachments` at 5 entries per message; this service handles the
// upload of one file at a time.
export const MESSAGE_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

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

export interface UploadedMessageMedia {
    url: string;
    path: string;
    contentType: string;
}

export class MessageMediaError extends Error {
    constructor(
        public readonly code: 'type' | 'size' | 'upload',
        message: string,
    ) {
        super(message);
        this.name = 'MessageMediaError';
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

export interface UploadMessageMediaInput {
    threadId: string;
    messageId: string;
    uri: string;
    contentType: string;
    sizeBytes?: number;
}

export async function uploadMessageMedia(
    input: UploadMessageMediaInput,
): Promise<UploadedMessageMedia> {
    if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) {
        throw new MessageMediaError(
            'type',
            `Unsupported file type (${input.contentType || 'unknown'}). Use JPG, PNG, WEBP, MP4, WEBM, or MOV.`,
        );
    }
    if (input.sizeBytes !== undefined && input.sizeBytes > MESSAGE_MEDIA_MAX_BYTES) {
        throw new MessageMediaError(
            'size',
            `File is too large (${(input.sizeBytes / (1024 * 1024)).toFixed(1)} MB). Max ${MESSAGE_MEDIA_MAX_BYTES / (1024 * 1024)} MB.`,
        );
    }

    const ext = EXTENSION_FOR[input.contentType];
    const id = Crypto.randomUUID();
    const storagePath = `threads/${input.threadId}/${input.messageId}/${id}.${ext}`;
    const objectRef = ref(storage, storagePath);

    try {
        const blob = await uriToBlob(input.uri);
        await uploadBytes(objectRef, blob, { contentType: input.contentType });
        const url = await getDownloadURL(objectRef);
        return {
            url,
            path: storagePath,
            contentType: input.contentType,
        };
    } catch (err) {
        throw new MessageMediaError(
            'upload',
            err instanceof Error ? err.message : 'Upload failed',
        );
    }
}

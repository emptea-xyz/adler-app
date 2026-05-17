import {
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
} from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { compressImageForUpload, uriToBlob } from '@/lib/utils/mediaUpload';
import { requireAuth } from '@/lib/utils/requireAuth';

const MAX_PHOTO_DIM = 1600;

const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/quicktime']);

export interface UploadedMedia {
    url: string;
    path: string;
}

export async function uploadBountySubmissionPhoto(localUri: string): Promise<UploadedMedia> {
    const uid = requireAuth();
    const compressedUri = await compressImageForUpload(localUri, MAX_PHOTO_DIM);
    const blob = await uriToBlob(compressedUri);
    const fileName = `${Date.now()}.jpg`;
    const path = `bountySubmissions/${uid}/${fileName}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(fileRef);
    return { url, path };
}

/**
 * Maps an unsupported video MIME to a user-friendly error before the
 * Storage rule rejects with a raw `storage/unauthorized`. The set
 * mirrors `storage.rules` (validBountySubmissionUpload).
 */
function assertSupportedVideoMime(mimeType: string): void {
    if (!ALLOWED_VIDEO_MIME.has(mimeType)) {
        throw new Error("This video format isn't supported. Try MP4 or MOV.");
    }
}

export async function uploadBountySubmissionVideo(
    localUri: string,
    mimeType = 'video/mp4',
    onProgress?: (fraction: number) => void,
): Promise<UploadedMedia> {
    const uid = requireAuth();
    assertSupportedVideoMime(mimeType);
    const blob = await uriToBlob(localUri);
    const ext = mimeType === 'video/quicktime' ? 'mov' : 'mp4';
    const fileName = `${Date.now()}.${ext}`;
    const path = `bountySubmissions/${uid}/${fileName}`;
    const fileRef = ref(storage, path);

    // Resumable upload exposes per-byte progress so the UI can show
    // "Uploading 42%" rather than a stuck "Submitting…" spinner for a
    // 60-second push.
    await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(fileRef, blob, { contentType: mimeType });
        task.on(
            'state_changed',
            (snap) => {
                if (snap.totalBytes > 0 && onProgress) {
                    onProgress(snap.bytesTransferred / snap.totalBytes);
                }
            },
            (err) => reject(err),
            () => resolve(),
        );
    });

    const url = await getDownloadURL(fileRef);
    return { url, path };
}

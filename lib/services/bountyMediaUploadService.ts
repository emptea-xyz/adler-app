import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { compressImageForUpload, uriToBlob } from '@/lib/utils/mediaUpload';
import { requireAuth } from '@/lib/utils/requireAuth';

export interface UploadedMedia {
    url: string;
    path: string;
}

export async function uploadBountySubmissionPhoto(localUri: string): Promise<UploadedMedia> {
    const uid = requireAuth();
    const compressedUri = await compressImageForUpload(localUri, 1600);
    const blob = await uriToBlob(compressedUri);
    const fileName = `${Date.now()}.jpg`;
    const path = `bountySubmissions/${uid}/${fileName}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(fileRef);
    return { url, path };
}

export async function uploadBountySubmissionVideo(
    localUri: string,
    mimeType = 'video/mp4',
): Promise<UploadedMedia> {
    const uid = requireAuth();
    const blob = await uriToBlob(localUri);
    const ext = mimeType === 'video/quicktime' ? 'mov' : 'mp4';
    const fileName = `${Date.now()}.${ext}`;
    const path = `bountySubmissions/${uid}/${fileName}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, blob, { contentType: mimeType });
    const url = await getDownloadURL(fileRef);
    return { url, path };
}

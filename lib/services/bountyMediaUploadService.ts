import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase/config';
import { compressImageForUpload, uriToBlob } from '@/lib/utils/mediaUpload';

export interface UploadedMedia {
    url: string;
    path: string;
}

export async function uploadBountySubmissionPhoto(localUri: string): Promise<UploadedMedia> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
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
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    const blob = await uriToBlob(localUri);
    const ext = mimeType === 'video/quicktime' ? 'mov' : 'mp4';
    const fileName = `${Date.now()}.${ext}`;
    const path = `bountySubmissions/${uid}/${fileName}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, blob, { contentType: mimeType });
    const url = await getDownloadURL(fileRef);
    return { url, path };
}

import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase/config';

async function compress(uri: string): Promise<string> {
    const ctx = ImageManipulator.ImageManipulator.manipulate(uri).resize({ width: 1600 });
    const imageRef = await ctx.renderAsync();
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

export interface UploadedPhoto {
    url: string;
    path: string;
}

export async function uploadBountySubmissionPhoto(localUri: string): Promise<UploadedPhoto> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required');
    const compressedUri = await compress(localUri);
    const blob = await uriToBlob(compressedUri);
    const fileName = `${Date.now()}.jpg`;
    const path = `bountySubmissions/${uid}/${fileName}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(fileRef);
    return { url, path };
}

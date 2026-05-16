// Group-logo upload. Compresses the picked image to ≤ 400 px and re-encodes
// as JPEG to stay under the 2 MB storage-rules cap. Mirrors the avatar flow
// in imageUploadService.uploadProfilePicture.
//
// Auth: the storage rule on `groupLogos/{groupId}/{fileName}` is auth-only
// (no admin check at the storage layer because rules can't query Firestore
// membership efficiently). The `updateGroup` Cloud Function is what
// enforces admin-only binding of the resulting URL onto the group doc, so
// stray uploads by non-admins are harmless garbage.

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { compressImageForUpload, uriToBlob } from '@/lib/utils/mediaUpload';
import { requireAuth } from '@/lib/utils/requireAuth';

/**
 * Upload a group logo and return the download URL. Caller is responsible
 * for binding the URL onto the group doc via `updateGroup({logoUrl})`.
 *
 * File path: `groupLogos/{groupId}/{timestamp}.jpg`. Each upload writes a
 * fresh filename so old logos don't get clobbered mid-fetch by other
 * clients; storage GC of orphans is out of scope for v1.
 */
export async function uploadGroupLogo(groupId: string, localUri: string): Promise<string> {
    requireAuth();
    const compressedUri = await compressImageForUpload(localUri, 400);
    const blob = await uriToBlob(compressedUri);
    const fileName = `${Date.now()}.jpg`;
    const storageRef = ref(storage, `groupLogos/${groupId}/${fileName}`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
}

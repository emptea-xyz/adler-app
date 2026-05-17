import * as ImageManipulator from 'expo-image-manipulator';

export async function uriToBlob(uri: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Failed to convert URI to blob'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
    });
}

/**
 * Compresses + re-encodes an image so it fits within a `maxDim` square
 * (both width AND height ≤ maxDim, preserving aspect ratio). Always
 * outputs JPEG, which neutralises HEIC/HEIF inputs from the iOS camera
 * roll. The two-pass resize is necessary because `resize({ width })`
 * alone leaves the height unconstrained on tall portraits, and
 * `resize({ width, height })` would distort aspect.
 */
export async function compressImageForUpload(
    uri: string,
    maxDim = 1200,
    compress = 0.7,
): Promise<string> {
    // First pass: clamp the wider side. If the source is tall (height >
    // maxDim after width-resize), the second pass clamps height instead.
    let imageRef = await ImageManipulator.ImageManipulator.manipulate(uri)
        .resize({ width: maxDim })
        .renderAsync();
    if (imageRef.height > maxDim) {
        const intermediate = await imageRef.saveAsync({
            compress: 1, // quality reserved for final pass
            format: ImageManipulator.SaveFormat.JPEG,
        });
        imageRef = await ImageManipulator.ImageManipulator.manipulate(intermediate.uri)
            .resize({ height: maxDim })
            .renderAsync();
    }
    const result = await imageRef.saveAsync({
        compress,
        format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
}

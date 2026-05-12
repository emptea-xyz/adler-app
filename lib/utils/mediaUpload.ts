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

export async function compressImageForUpload(
    uri: string,
    maxDim = 1200,
    compress = 0.7,
): Promise<string> {
    const context = ImageManipulator.ImageManipulator.manipulate(uri)
        .resize({ width: maxDim });
    const imageRef = await context.renderAsync();
    const result = await imageRef.saveAsync({
        compress,
        format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
}

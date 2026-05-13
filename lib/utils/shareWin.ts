import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { View } from 'react-native';
import type { RefObject } from 'react';
import { haptic } from '@/lib/utils/haptic';

interface CaptureAndShareArgs {
    ref: RefObject<View | null>;
    fileName: string;
}

export async function captureAndShareWin({ ref, fileName }: CaptureAndShareArgs) {
    if (!ref.current) throw new Error('Share card not mounted');
    haptic('medium');
    const uri = await captureRef(ref, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        fileName,
    });
    await Share.share({ url: uri });
    haptic('heavy');
}

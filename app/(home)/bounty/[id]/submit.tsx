import React, { useEffect, useState } from 'react';
import { View, Image, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useBounty } from '@/hooks/useBounty';
import { useMyGroupIds } from '@/hooks/useMyGroupIds';
import {
    createSubmission,
    createVideoSubmission,
    createLinkSubmission,
} from '@/lib/services/submissionService';
import { qk } from '@/lib/constants/queryKeys';
import { haptic } from '@/lib/utils/haptic';
import { toast, toastError } from '@/lib/utils/toast';
import { LINK_URL_RE } from '@/lib/constants/urlRegex';

const URL_RE = LINK_URL_RE;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // mirrors storage.rules

export default function SubmitScreen() {
    const { id: idParam } = useLocalSearchParams<{ id: string }>();
    const id = String(idParam ?? '');
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const bountyQuery = useBounty(id);
    const bounty = bountyQuery.data;
    const kind = bounty?.submissionKind ?? 'photo';
    const { user } = useAuth();
    const myGroupIds = useMyGroupIds();

    const isGroupBounty = !!bounty && bounty.scope === 'group' && !!bounty.groupId;
    const isPoster = !!user && !!bounty && bounty.posterId === user.id;
    const blockedByGroup =
        isGroupBounty && !isPoster && !myGroupIds.has(bounty!.groupId!);

    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [videoMime, setVideoMime] = useState<string>('video/mp4');
    const [linkUrl, setLinkUrl] = useState('');
    const [pending, setPending] = useState(false);
    const [videoProgress, setVideoProgress] = useState<number | null>(null);

    useEffect(() => {
        // Auto-launch the camera on mount for photo bounties; video + link
        // bounties wait for the user to act. Don't auto-launch if the
        // viewer is blocked at the group-membership gate.
        if (kind !== 'photo' || photoUri || blockedByGroup) return;
        (async () => {
            const perm = await ImagePicker.getCameraPermissionsAsync();
            if (!perm.granted) {
                const requested = await ImagePicker.requestCameraPermissionsAsync();
                if (!requested.granted) return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
            });
            if (!result.canceled && result.assets[0]) {
                setPhotoUri(result.assets[0].uri);
            }
        })().catch(() => null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind]);

    const pickPhotoFromLibrary = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const retakePhoto = async () => {
        setPhotoUri(null);
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const pickVideoFromLibrary = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.85,
            videoMaxDuration: 60,
        });
        if (!result.canceled && result.assets[0]) {
            setVideoUri(result.assets[0].uri);
            setVideoMime(result.assets[0].mimeType ?? 'video/mp4');
        }
    };

    const recordVideo = async () => {
        const perm = await ImagePicker.getCameraPermissionsAsync();
        if (!perm.granted) {
            const requested = await ImagePicker.requestCameraPermissionsAsync();
            if (!requested.granted) return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.85,
            videoMaxDuration: 60,
        });
        if (!result.canceled && result.assets[0]) {
            setVideoUri(result.assets[0].uri);
            setVideoMime(result.assets[0].mimeType ?? 'video/mp4');
        }
    };

    const onConfirmPhoto = async () => {
        if (!photoUri || !id) return;
        setPending(true);
        try {
            haptic('medium');
            await createSubmission({ bountyId: id, photoUri });
            haptic('heavy');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: qk.submissions.byBounty(id) }),
                queryClient.invalidateQueries({ queryKey: qk.bounties.detail(id) }),
            ]);
            toast.success('Submitted. The poster will review your photo.');
            router.back();
        } catch (err) {
            toastError(err, 'Could not submit');
        } finally {
            setPending(false);
        }
    };

    const onConfirmVideo = async () => {
        if (!videoUri || !id) return;
        // Pre-check size client-side so a 200MB video doesn't lock the
        // submit button for minutes only to fail at the Storage rule.
        try {
            const info = await FileSystem.getInfoAsync(videoUri);
            // `size` is only populated on local file:// URIs (it is on
            // iOS picker output). Best-effort: skip the check otherwise.
            if (
                info.exists &&
                typeof (info as { size?: number }).size === 'number' &&
                (info as { size: number }).size > VIDEO_MAX_BYTES
            ) {
                toast.error('Video is too large (max 100 MB). Trim it and try again.');
                return;
            }
        } catch {
            // Best-effort — if the size probe fails we still try the upload.
        }
        setPending(true);
        setVideoProgress(0);
        try {
            haptic('medium');
            await createVideoSubmission({
                bountyId: id,
                videoUri,
                mimeType: videoMime,
                onProgress: (frac) => setVideoProgress(frac),
            });
            haptic('heavy');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: qk.submissions.byBounty(id) }),
                queryClient.invalidateQueries({ queryKey: qk.bounties.detail(id) }),
            ]);
            toast.success('Submitted. The poster will review your video.');
            router.back();
        } catch (err) {
            toastError(err, 'Could not submit');
        } finally {
            setPending(false);
            setVideoProgress(null);
        }
    };

    const onConfirmLink = async () => {
        if (!id) return;
        const trimmed = linkUrl.trim();
        if (!URL_RE.test(trimmed)) {
            toast.error('Enter a full URL (https://…).');
            return;
        }
        setPending(true);
        try {
            haptic('medium');
            await createLinkSubmission({ bountyId: id, linkUrl: trimmed });
            haptic('heavy');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: qk.submissions.byBounty(id) }),
                queryClient.invalidateQueries({ queryKey: qk.bounties.detail(id) }),
            ]);
            toast.success('Submitted. The poster will review your link.');
            router.back();
        } catch (err) {
            toastError(err, 'Could not submit');
        } finally {
            setPending(false);
        }
    };

    if (blockedByGroup) {
        return (
            <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
                <ScreenHeader title="Submit" />
                <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
                    <EmptyState
                        title="Members-only bounty"
                        description="Join the group to submit. The poster will only accept submissions from members."
                    />
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
            <ScreenHeader title="Submit" />
            {bounty ? (
                <View style={{ paddingHorizontal: 8, paddingTop: 8 }}>
                    <ThemedText type="caption-semibold" style={{ color: theme[500] }}>PROMPT</ThemedText>
                    <ThemedText type="body-md" style={{ color: theme[800], marginTop: 4 }} numberOfLines={3}>
                        {bounty.prompt}
                    </ThemedText>
                </View>
            ) : null}

            {kind === 'link' ? (
                <LinkSubmitBody
                    linkUrl={linkUrl}
                    onChangeLinkUrl={setLinkUrl}
                    pending={pending}
                    onConfirm={onConfirmLink}
                    insets={insets}
                />
            ) : kind === 'video' ? (
                <VideoSubmitBody
                    videoUri={videoUri}
                    onClearVideo={() => setVideoUri(null)}
                    onPickFromLibrary={pickVideoFromLibrary}
                    onRecord={recordVideo}
                    pending={pending}
                    progress={videoProgress}
                    onConfirm={onConfirmVideo}
                    insets={insets}
                />
            ) : (
                <PhotoSubmitBody
                    photoUri={photoUri}
                    onClearPhoto={() => setPhotoUri(null)}
                    onPickFromLibrary={pickPhotoFromLibrary}
                    onRetake={retakePhoto}
                    pending={pending}
                    onConfirm={onConfirmPhoto}
                    insets={insets}
                />
            )}
        </ThemedView>
    );
}

function PhotoSubmitBody({
    photoUri,
    onClearPhoto,
    onPickFromLibrary,
    onRetake,
    pending,
    onConfirm,
    insets,
}: {
    photoUri: string | null;
    onClearPhoto: () => void;
    onPickFromLibrary: () => void;
    onRetake: () => void;
    pending: boolean;
    onConfirm: () => void;
    insets: { bottom: number };
}) {
    const { theme } = useTheme();
    return (
        <>
            <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
                {photoUri ? (
                    <View style={{ position: 'relative' }}>
                        <Image
                            source={{ uri: photoUri }}
                            style={{
                                width: '100%',
                                aspectRatio: 1,
                                borderRadius: 16,
                                backgroundColor: theme[100],
                            }}
                        />
                        <Pressable
                            onPress={onClearPhoto}
                            style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: theme[950],
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Icon name="xmark" size={16} color={theme[50]} weight="semibold" />
                        </Pressable>
                    </View>
                ) : (
                    <View style={{ alignItems: 'center', gap: 16 }}>
                        <ThemedText type="body-md" style={{ color: theme[500], textAlign: 'center' }}>
                            Take a photo or pick one from your library.
                        </ThemedText>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Button
                                variant="primary"
                                size="lg"
                                title="Open camera"
                                leftIcon={<Icon name="camera.fill" size={22} color={theme[50]} />}
                                onPress={onRetake}
                            />
                            <Button
                                variant="secondary"
                                size="lg"
                                title="Library"
                                leftIcon={<Icon name="photo.fill" size={22} color={theme[950]} />}
                                onPress={onPickFromLibrary}
                            />
                        </View>
                    </View>
                )}
            </View>

            {photoUri ? (
                <View
                    style={{
                        padding: 16,
                        paddingBottom: 16 + insets.bottom,
                        backgroundColor: theme[50],
                        gap: 8,
                    }}
                >
                    <Button
                        size="lg"
                        variant="primary"
                        title={pending ? 'Submitting…' : 'Confirm submission'}
                        loading={pending}
                        disabled={pending}
                        onPress={onConfirm}
                    />
                    <Button
                        size="default"
                        variant="tertiary"
                        title="Pick another"
                        onPress={onPickFromLibrary}
                        disabled={pending}
                    />
                </View>
            ) : null}
        </>
    );
}

function VideoSubmitBody({
    videoUri,
    onClearVideo,
    onPickFromLibrary,
    onRecord,
    pending,
    progress,
    onConfirm,
    insets,
}: {
    videoUri: string | null;
    onClearVideo: () => void;
    onPickFromLibrary: () => void;
    onRecord: () => void;
    pending: boolean;
    progress: number | null;
    onConfirm: () => void;
    insets: { bottom: number };
}) {
    const { theme } = useTheme();
    return (
        <>
            <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
                {videoUri ? (
                    <View style={{ position: 'relative' }}>
                        <View
                            style={{
                                width: '100%',
                                aspectRatio: 1,
                                borderRadius: 16,
                                backgroundColor: theme[100],
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Icon name="play.rectangle.fill" size={64} color={theme[700]} />
                            <ThemedText
                                type="body-sm"
                                style={{ color: theme[600], marginTop: 8 }}
                                numberOfLines={1}
                            >
                                Video ready to submit
                            </ThemedText>
                        </View>
                        <Pressable
                            onPress={onClearVideo}
                            style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: theme[950],
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Icon name="xmark" size={16} color={theme[50]} weight="semibold" />
                        </Pressable>
                    </View>
                ) : (
                    <View style={{ alignItems: 'center', gap: 16 }}>
                        <ThemedText type="body-md" style={{ color: theme[500], textAlign: 'center' }}>
                            Record a clip or pick one from your library.
                        </ThemedText>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Button
                                variant="primary"
                                size="lg"
                                title="Record"
                                leftIcon={<Icon name="video.fill" size={22} color={theme[50]} />}
                                onPress={onRecord}
                            />
                            <Button
                                variant="secondary"
                                size="lg"
                                title="Library"
                                leftIcon={<Icon name="photo.fill" size={22} color={theme[950]} />}
                                onPress={onPickFromLibrary}
                            />
                        </View>
                    </View>
                )}
            </View>

            {videoUri ? (
                <View
                    style={{
                        padding: 16,
                        paddingBottom: 16 + insets.bottom,
                        backgroundColor: theme[50],
                        gap: 8,
                    }}
                >
                    <Button
                        size="lg"
                        variant="primary"
                        title={
                            pending
                                ? progress !== null && progress < 1
                                    ? `Uploading ${Math.round(progress * 100)}%`
                                    : 'Submitting…'
                                : 'Confirm submission'
                        }
                        loading={pending}
                        disabled={pending}
                        onPress={onConfirm}
                    />
                    <Button
                        size="default"
                        variant="tertiary"
                        title="Pick another"
                        onPress={onPickFromLibrary}
                        disabled={pending}
                    />
                </View>
            ) : null}
        </>
    );
}

function LinkSubmitBody({
    linkUrl,
    onChangeLinkUrl,
    pending,
    onConfirm,
    insets,
}: {
    linkUrl: string;
    onChangeLinkUrl: (v: string) => void;
    pending: boolean;
    onConfirm: () => void;
    insets: { bottom: number };
}) {
    const { theme } = useTheme();
    const canSubmit = !pending && URL_RE.test(linkUrl.trim());
    return (
        <>
            <View style={{ flex: 1, padding: 16, gap: 16 }}>
                <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                    YOUR LINK
                </ThemedText>
                <TextInput
                    value={linkUrl}
                    onChangeText={onChangeLinkUrl}
                    placeholder="https://github.com/your/repo"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="done"
                    leftIcon={<Icon name="link" size={18} color={theme[400]} />}
                />
                <ThemedText type="body-sm" style={{ color: theme[500] }}>
                    The poster will review your link manually. Only you and the
                    poster can see what you submit.
                </ThemedText>
            </View>

            <View
                style={{
                    padding: 16,
                    paddingBottom: 16 + insets.bottom,
                    backgroundColor: theme[50],
                }}
            >
                <Button
                    size="lg"
                    variant="primary"
                    title={pending ? 'Submitting…' : 'Submit link'}
                    loading={pending}
                    disabled={!canSubmit}
                    onPress={onConfirm}
                />
            </View>
        </>
    );
}

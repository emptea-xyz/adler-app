import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Linking,
    Pressable,
    ScrollView,
    View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
    Camera,
    CheckCircle2,
    Images,
    Paperclip,
    Plus,
    Send,
    TriangleAlert,
} from 'lucide-react-native';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import { Button } from '@/components/ui/Button';
import { Pill, type PillIntent } from '@/components/ui/Pill';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { qk } from '@/lib/constants/queryKeys';
import { getDisputeByOrder, fileDispute } from '@/lib/services/disputesService';
import { approveRelease } from '@/lib/escrow/approveRelease';
import { uploadMessageMedia } from '@/lib/services/messageMediaUploadService';
import { getOrder } from '@/lib/services/ordersService';
import { getProfile } from '@/lib/services/profileService';
import { getReviewByReviewer } from '@/lib/services/reviewsService';
import { submitDelivery } from '@/lib/escrow/submitDelivery';
import {
    approveDeliverable,
    countRevisionRequests,
    getThread,
    listMessages,
    markThreadRead,
    requestRevision,
    sendMessage,
    submitDeliverable,
} from '@/lib/services/threadsService';
import {
    MESSAGE_BODY_MAX,
    REVISION_CAP,
    type Message,
    type Thread,
} from '@/lib/types/thread';
import {
    DISPUTE_OUTCOME_LABEL,
    PENDING_SETTLEMENT,
} from '@/lib/types/dispute';
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/lib/types/order';
import { formatRelative } from '@/lib/utils/dates';
import { formatSol } from '@/lib/utils/formatNumber';
import { toast } from '@/lib/utils/toast';

interface ComposerAttachment {
    id: string;
    uri: string;
    label: string;
    contentType: string;
    sizeBytes?: number;
}

function orderStatusIntent(status: OrderStatus): PillIntent {
    if (status === 'complete' || status === 'paid') return 'lime';
    if (status === 'delivered') return 'cyan';
    if (status === 'failed') return 'orange';
    return 'neutral';
}

function threadKindIntent(kind: 'order' | 'application'): PillIntent {
    return kind === 'order' ? 'pink' : 'neutral';
}

export default function ThreadScreen() {
    const { threadId } = useLocalSearchParams<{ threadId: string }>();
    const { user } = useAuth();
    const solana = useEmbeddedSolanaWallet();
    const wallet = solana.wallets?.[0];
    const { theme } = useTheme();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

    const threadQuery = useQuery({
        queryKey: threadId ? qk.threads.detail(threadId) : ['threads', 'detail', 'missing'],
        enabled: !!threadId,
        queryFn: () => getThread(threadId!),
    });

    const messagesQuery = useQuery({
        queryKey: threadId ? qk.threads.messages(threadId) : ['threads', 'messages', 'missing'],
        enabled: !!threadId,
        queryFn: () => listMessages(threadId!),
    });

    const orderId = threadQuery.data?.kind === 'order' ? threadQuery.data.parentId : null;

    const orderQuery = useQuery({
        queryKey: orderId ? qk.orders.detail(orderId) : ['orders', 'detail', 'missing'],
        enabled: !!orderId,
        queryFn: () => getOrder(orderId!),
    });

    const disputeQuery = useQuery({
        queryKey: orderId ? qk.disputes.byOrder(orderId) : ['disputes', 'byOrder', 'missing'],
        enabled: !!orderId,
        queryFn: () => getDisputeByOrder(orderId!),
    });

    const myReviewQuery = useQuery({
        queryKey: user && orderId ? qk.reviews.myForOrder(orderId, user.id) : ['reviews', 'myForOrder', 'missing'],
        enabled: !!user && !!orderId && orderQuery.data?.status === 'complete',
        queryFn: () => getReviewByReviewer(orderId!, user!.id),
    });

    useEffect(() => {
        if (!threadId || !user?.id || !threadQuery.data) return;
        if ((threadQuery.data.unreadCount[user.id] ?? 0) < 1) return;
        markThreadRead(threadId)
            .then(() => {
                queryClient.setQueryData<Thread | null>(qk.threads.detail(threadId), (current) => {
                    if (!current) return current;
                    return {
                        ...current,
                        unreadCount: {
                            ...current.unreadCount,
                            [user.id]: 0,
                        },
                    };
                });
                return queryClient.invalidateQueries({ queryKey: qk.threads.byParticipant(user.id) });
            })
            .catch(() => null);
    }, [threadId, threadQuery.data, user?.id, queryClient]);

    const title = useMemo(() => {
        if (!threadQuery.data || !user?.id) return 'Thread';
        const counterpartyId =
            threadQuery.data.participants.find((id) => id !== user.id) ??
            threadQuery.data.participants[0] ??
            user.id;
        const snapshot = threadQuery.data.participantSnapshots[counterpartyId];
        return snapshot?.displayName ?? (snapshot?.handle ? `@${snapshot.handle}` : 'Thread');
    }, [threadQuery.data, user?.id]);

    const messages = messagesQuery.data ?? [];
    const order = orderQuery.data;
    const revisionsUsed = countRevisionRequests(messages);
    const revisionsExhausted = revisionsUsed >= REVISION_CAP;
    const isOrderThread = threadQuery.data?.kind === 'order' && !!order;
    const isBuyer = !!user && !!order && order.buyerId === user.id;
    const isSeller = !!user && !!order && order.sellerId === user.id;
    const dispute = disputeQuery.data;
    const disputeOpen = dispute?.status === 'open';
    const myReview = myReviewQuery.data;

    const canSubmitDeliverable = isOrderThread && isSeller && order.status === 'paid' && !disputeOpen;
    const canApprove = isOrderThread && isBuyer && order.status === 'delivered' && !disputeOpen;
    const canRequestRevision = isOrderThread && isBuyer && order.status === 'delivered' && !disputeOpen;
    const canFileDispute =
        isOrderThread &&
        !dispute &&
        ((isBuyer && (order.status === 'paid' || order.status === 'delivered')) ||
            (isSeller && order.status === 'delivered'));
    const canRate = isOrderThread && order.status === 'complete' && !myReview;

    const pickFromCamera = async () => {
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                toast.error('Camera access denied');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images', 'videos'],
                quality: 1,
            });
            if (result.canceled || !result.assets[0]) return;
            const asset = result.assets[0];
            setAttachments((prev) => [
                ...prev,
                {
                    id: Crypto.randomUUID(),
                    uri: asset.uri,
                    label: asset.fileName ?? 'camera',
                    contentType: asset.mimeType ?? 'image/jpeg',
                    sizeBytes: asset.fileSize,
                },
            ]);
        } catch (err: any) {
            toast.error(err?.message ?? 'Camera failed');
        }
    };

    const pickFromGallery = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                toast.error('Photo library access denied');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsMultipleSelection: true,
                quality: 1,
                selectionLimit: 5,
            });
            if (result.canceled) return;
            const picked: ComposerAttachment[] = result.assets.map((asset) => ({
                id: Crypto.randomUUID(),
                uri: asset.uri,
                label: asset.fileName ?? 'gallery',
                contentType: asset.mimeType ?? 'image/jpeg',
                sizeBytes: asset.fileSize,
            }));
            setAttachments((prev) => [...prev, ...picked].slice(0, 5));
        } catch (err: any) {
            toast.error(err?.message ?? 'Gallery picker failed');
        }
    };

    const pickFromFiles = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                multiple: true,
                type: ['image/*', 'video/*'],
                copyToCacheDirectory: true,
            });
            if (result.canceled) return;
            const picked: ComposerAttachment[] = result.assets.map((asset) => ({
                id: Crypto.randomUUID(),
                uri: asset.uri,
                label: asset.name ?? 'file',
                contentType: asset.mimeType ?? 'application/octet-stream',
                sizeBytes: asset.size,
            }));
            setAttachments((prev) => [...prev, ...picked].slice(0, 5));
        } catch (err: any) {
            toast.error(err?.message ?? 'Files picker failed');
        }
    };

    const runSend = async (
        mode: 'text' | 'deliverable' | 'revision' | 'approval' | 'dispute',
    ) => {
        if (!threadId) return;
        const text = message.trim();
        if (mode === 'text' && !text && attachments.length < 1) return;
        if ((mode === 'deliverable' || mode === 'revision' || mode === 'dispute') && !text) {
            toast.error('Write a short message first');
            return;
        }
        if ((mode === 'deliverable' || mode === 'approval') && !order) {
            toast.error('Order context missing');
            return;
        }

        setSending(true);
        try {
            let uploadedUrls: string[] = [];
            const messageId = Crypto.randomUUID();
            const supportsAttachments = mode === 'text' || mode === 'deliverable';
            if (!supportsAttachments && attachments.length > 0) {
                toast.error('Attachments are only supported for chat and deliverables');
                return;
            }
            if (supportsAttachments && attachments.length > 0) {
                const uploads = await Promise.all(
                    attachments.map((asset) =>
                        uploadMessageMedia({
                            threadId,
                            messageId,
                            uri: asset.uri,
                            contentType: asset.contentType,
                            sizeBytes: asset.sizeBytes,
                        }),
                    ),
                );
                uploadedUrls = uploads.map((upload) => upload.url);
            }

            if (mode === 'text') {
                await sendMessage({
                    threadId,
                    kind: 'text',
                    body: text || 'Sent attachment',
                    attachments: uploadedUrls,
                    messageId,
                });
            } else if (mode === 'deliverable') {
                if (!wallet?.address) throw new Error('Creator wallet missing');
                if (!order!.contractId32) throw new Error('Escrow contract missing');
                const buyerProfile = await getProfile(order!.buyerId);
                if (!buyerProfile?.walletAddress) throw new Error('Buyer wallet missing');
                const provider = await wallet.getProvider();
                const { signature } = await submitDelivery({
                    contractIdHex: order!.contractId32,
                    brandWalletAddress: buyerProfile.walletAddress,
                    creatorWalletAddress: wallet.address,
                    provider,
                });
                await submitDeliverable({
                    threadId,
                    orderId: order!.id,
                    body: text,
                    attachments: uploadedUrls,
                    messageId,
                    escrowTxSignature: signature,
                });
            } else if (mode === 'revision') {
                await requestRevision({ threadId, body: text });
            } else if (mode === 'approval') {
                if (!wallet?.address) throw new Error('Buyer wallet missing');
                if (!order!.contractId32) throw new Error('Escrow contract missing');
                const sellerProfile = await getProfile(order!.sellerId);
                if (!sellerProfile?.walletAddress) throw new Error('Creator wallet missing');
                const provider = await wallet.getProvider();
                const { signature } = await approveRelease({
                    contractIdHex: order!.contractId32,
                    brandWalletAddress: wallet.address,
                    creatorPubkey: sellerProfile.walletAddress,
                    provider,
                });
                await approveDeliverable({
                    threadId,
                    orderId: order!.id,
                    body: text || undefined,
                    messageId,
                    escrowTxSignature: signature ?? undefined,
                });
            } else {
                await fileDispute({ orderId: order!.id, reason: text });
            }

            setMessage('');
            setAttachments([]);
            setActionsOpen(false);
            await Promise.all([
                messagesQuery.refetch(),
                threadQuery.refetch(),
                orderQuery.refetch(),
                disputeQuery.refetch(),
                user?.id ? queryClient.invalidateQueries({ queryKey: qk.threads.byParticipant(user.id) }) : Promise.resolve(),
                user?.id && order ? queryClient.invalidateQueries({ queryKey: qk.orders.byBuyer(order.buyerId) }) : Promise.resolve(),
                user?.id && order ? queryClient.invalidateQueries({ queryKey: qk.orders.bySeller(order.sellerId) }) : Promise.resolve(),
                order?.id ? queryClient.invalidateQueries({ queryKey: qk.escrow.contractEscrow(order.id) }) : Promise.resolve(),
            ]);
            if (mode === 'approval' && order) {
                router.push(`/order/${order.id}?review=1`);
            }
        } catch (err: any) {
            toast.error(err?.message ?? 'Action failed');
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        if (item.kind === 'system') {
            return (
                <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                    <ThemedText type="caption" style={{ color: theme[500] }}>
                        {item.body}
                    </ThemedText>
                </View>
            );
        }
        const mine = item.senderId === user?.id;
        const approval = item.kind === 'approval';
        return (
            <View
                style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '84%',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 6,
                    backgroundColor: approval ? theme[200] : mine ? theme[950] : theme[100],
                }}
            >
                {item.kind !== 'text' ? (
                    <ThemedText type="caption-semibold" style={{ color: mine ? theme[200] : theme[500] }}>
                        {item.kind.replace('_', ' ')}
                    </ThemedText>
                ) : null}
                <ThemedText type="body-sm" style={{ color: mine ? theme[50] : theme[950] }}>
                    {item.body}
                </ThemedText>
                {item.attachments.map((url) => (
                    <Pressable key={url} onPress={() => Linking.openURL(url)}>
                        <ThemedText type="caption-semibold" style={{ color: mine ? theme[200] : theme[700] }}>
                            Attachment
                        </ThemedText>
                    </Pressable>
                ))}
                <ThemedText type="caption" style={{ color: mine ? theme[200] : theme[500] }}>
                    {formatRelative(item.createdAt)}
                </ThemedText>
            </View>
        );
    };

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="flex-1">
                <ScreenHeader title={title} onBack={() => router.back()} />
                {threadQuery.isLoading || messagesQuery.isLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={theme[950]} />
                    </View>
                ) : !threadQuery.data ? (
                    <View className="flex-1 items-center justify-center px-4">
                        <ThemedText type="body-md" style={{ color: theme[500] }}>
                            Thread not found.
                        </ThemedText>
                    </View>
                ) : (
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior="padding"
                    >
                        <View
                            style={{
                                paddingHorizontal: 16,
                                paddingBottom: 8,
                                gap: 8,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Pill
                                    intent={threadKindIntent(threadQuery.data.kind)}
                                    label={threadQuery.data.kind === 'order' ? 'Order' : 'Application'}
                                />
                                {order ? (
                                    <Pill
                                        intent={orderStatusIntent(order.status)}
                                        label={`${formatSol(order.amountSol)} SOL · ${ORDER_STATUS_LABEL[order.status]}`}
                                    />
                                ) : null}
                            </View>
                            {dispute?.status === 'open' ? (
                                <View
                                    style={{
                                        borderRadius: 12,
                                        backgroundColor: theme[100],
                                        borderWidth: 1,
                                        borderColor: theme[300],
                                        padding: 10,
                                        flexDirection: 'row',
                                        gap: 8,
                                    }}
                                >
                                    <TriangleAlert size={16} color={theme[950]} />
                                    <ThemedText type="caption" style={{ color: theme[700], flex: 1 }}>
                                        Dispute open. Deliveries, approvals, and revisions are paused.
                                    </ThemedText>
                                </View>
                            ) : null}
                            {dispute?.status === 'resolved' && dispute.outcome ? (
                                <View
                                    style={{
                                        borderRadius: 12,
                                        backgroundColor: theme[100],
                                        borderWidth: 1,
                                        borderColor: theme[300],
                                        padding: 10,
                                        flexDirection: 'row',
                                        gap: 8,
                                    }}
                                >
                                    <CheckCircle2 size={16} color={theme[950]} />
                                    <ThemedText type="caption" style={{ color: theme[700], flex: 1 }}>
                                        Dispute resolved — {DISPUTE_OUTCOME_LABEL[dispute.outcome]}
                                        {PENDING_SETTLEMENT[dispute.outcome]
                                            ? '. Settlement pending the on-chain escrow program.'
                                            : '.'}
                                    </ThemedText>
                                </View>
                            ) : null}
                        </View>

                        <FlatList
                            data={messages}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingTop: 6,
                                paddingBottom: 12,
                                gap: 10,
                                flexGrow: 1,
                                justifyContent: 'flex-end',
                            }}
                            ListEmptyComponent={
                                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
                                    <ThemedText type="body-sm" style={{ color: theme[500] }}>
                                        No messages yet.
                                    </ThemedText>
                                </View>
                            }
                            renderItem={renderMessage}
                        />

                        <View
                            style={{
                                paddingHorizontal: 16,
                                paddingTop: 8,
                                paddingBottom: 12,
                                borderTopWidth: 1,
                                borderTopColor: theme[200],
                                gap: 8,
                            }}
                        >
                            {(canSubmitDeliverable || canApprove || canRequestRevision || canFileDispute || canRate) ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                    {canSubmitDeliverable ? (
                                        <Button
                                            title="Submit deliverable"
                                            size="sm"
                                            onPress={() => runSend('deliverable')}
                                            loading={sending}
                                            disabled={sending}
                                        />
                                    ) : null}
                                    {canApprove ? (
                                        <Button
                                            title="Approve & complete"
                                            size="sm"
                                            onPress={() => runSend('approval')}
                                            loading={sending}
                                            disabled={sending}
                                        />
                                    ) : null}
                                    {canRequestRevision ? (
                                        <Button
                                            title={revisionsExhausted ? 'Open dispute' : `Request revision (${Math.min(revisionsUsed + 1, REVISION_CAP)} of ${REVISION_CAP})`}
                                            size="sm"
                                            variant="secondary"
                                            onPress={() => runSend(revisionsExhausted ? 'dispute' : 'revision')}
                                            loading={sending}
                                            disabled={sending}
                                        />
                                    ) : null}
                                    {canFileDispute && !canRequestRevision ? (
                                        <Button
                                            title="Open dispute"
                                            size="sm"
                                            variant="secondary"
                                            onPress={() => runSend('dispute')}
                                            loading={sending}
                                            disabled={sending}
                                        />
                                    ) : null}
                                    {canRate ? (
                                        <Button
                                            title="Rate counterparty"
                                            size="sm"
                                            variant="secondary"
                                            onPress={() => router.push(`/order/${order!.id}`)}
                                            disabled={sending}
                                        />
                                    ) : null}
                                </ScrollView>
                            ) : null}

                            {actionsOpen ? (
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <Button
                                        title="Camera"
                                        size="sm"
                                        variant="secondary"
                                        onPress={pickFromCamera}
                                        leftIcon={<Camera size={14} color={theme[950]} />}
                                        disabled={sending}
                                    />
                                    <Button
                                        title="Gallery"
                                        size="sm"
                                        variant="secondary"
                                        onPress={pickFromGallery}
                                        leftIcon={<Images size={14} color={theme[950]} />}
                                        disabled={sending}
                                    />
                                    <Button
                                        title="Files"
                                        size="sm"
                                        variant="secondary"
                                        onPress={pickFromFiles}
                                        leftIcon={<Paperclip size={14} color={theme[950]} />}
                                        disabled={sending}
                                    />
                                </View>
                            ) : null}

                            {attachments.length > 0 ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {attachments.map((asset) => (
                                        <Pressable
                                            key={asset.id}
                                            onPress={() =>
                                                setAttachments((prev) => prev.filter((row) => row.id !== asset.id))
                                            }
                                            style={{
                                                borderRadius: 999,
                                                backgroundColor: theme[100],
                                                paddingHorizontal: 10,
                                                paddingVertical: 6,
                                            }}
                                        >
                                            <ThemedText type="caption" style={{ color: theme[700] }} numberOfLines={1}>
                                                {asset.label}
                                            </ThemedText>
                                        </Pressable>
                                    ))}
                                </View>
                            ) : null}

                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                                <Pressable
                                    onPress={() => setActionsOpen((prev) => !prev)}
                                    style={{
                                        width: 38,
                                        height: 44,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: theme[100],
                                    }}
                                >
                                    <Plus size={18} color={theme[950]} />
                                </Pressable>
                                <View style={{ flex: 1 }}>
                                    <TextInput
                                        value={message}
                                        onChangeText={setMessage}
                                        placeholder="Write a message"
                                        multiline
                                        maxLength={MESSAGE_BODY_MAX}
                                        style={{ minHeight: 44, maxHeight: 120, textAlignVertical: 'top' }}
                                    />
                                </View>
                                <Pressable
                                    onPress={() => runSend('text')}
                                    disabled={sending || (!message.trim() && attachments.length < 1)}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor:
                                            sending || (!message.trim() && attachments.length < 1)
                                                ? theme[300]
                                                : theme[950],
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Send message"
                                >
                                    <Send size={18} color={theme[50]} />
                                </Pressable>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                )}
            </SafeAreaView>
        </ThemedView>
    );
}

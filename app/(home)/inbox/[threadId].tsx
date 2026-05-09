import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react-native';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { ThemedText } from '@/components/base/ThemedText';
import { ThemedView } from '@/components/base/ThemedView';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { qk } from '@/lib/constants/queryKeys';
import {
    getThread,
    listMessages,
    markThreadRead,
    sendMessage,
} from '@/lib/services/threadsService';
import { MESSAGE_BODY_MAX, type Message } from '@/lib/types/thread';
import { formatRelative } from '@/lib/utils/dates';
import { toast } from '@/lib/utils/toast';

export default function ThreadScreen() {
    const { threadId } = useLocalSearchParams<{ threadId: string }>();
    const { user } = useAuth();
    const { theme } = useTheme();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

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

    useEffect(() => {
        if (!threadId || !user?.id || !threadQuery.data) return;
        markThreadRead(threadId)
            .then(() => queryClient.invalidateQueries({ queryKey: qk.threads.byParticipant(user.id) }))
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

    const onSend = async () => {
        if (!threadId) return;
        const body = message.trim();
        if (!body) return;
        if (body.length > MESSAGE_BODY_MAX) {
            toast.error(`Message must be ${MESSAGE_BODY_MAX} characters or less`);
            return;
        }
        setSending(true);
        try {
            await sendMessage({
                threadId,
                body,
                kind: 'text',
            });
            setMessage('');
            await Promise.all([
                messagesQuery.refetch(),
                threadQuery.refetch(),
                user?.id ? queryClient.invalidateQueries({ queryKey: qk.threads.byParticipant(user.id) }) : Promise.resolve(),
            ]);
        } catch (err: any) {
            toast.error(err?.message ?? 'Message failed');
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const mine = item.senderId === user?.id;
        return (
            <View
                style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 6,
                    backgroundColor: mine ? theme[950] : theme[100],
                }}
            >
                <ThemedText type="body-sm" style={{ color: mine ? theme[50] : theme[950] }}>
                    {item.body}
                </ThemedText>
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
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        <FlatList
                            data={messagesQuery.data ?? []}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingVertical: 16,
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
                                flexDirection: 'row',
                                gap: 8,
                                alignItems: 'flex-end',
                            }}
                        >
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
                                onPress={onSend}
                                disabled={sending || !message.trim()}
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: sending || !message.trim() ? theme[300] : theme[950],
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Send message"
                            >
                                <Send size={18} color={theme[50]} />
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                )}
            </SafeAreaView>
        </ThemedView>
    );
}

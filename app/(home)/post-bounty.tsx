import React, { useState } from 'react';
import { ScrollView, View, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/base/ThemedView';
import { ThemedText } from '@/components/base/ThemedText';
import { ScreenHeader } from '@/components/base/ScreenHeader';
import { SectionLabel } from '@/components/base/SectionLabel';
import { Button } from '@/components/ui/Button';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { NumberInput } from '@/components/ui/NumberInput';
import TextInput from '@/components/ui/TextInput';
import { useBountyEscrow } from '@/hooks/useBountyEscrow';
import { qk } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { parseSolAmount, formatSol } from '@/lib/utils/formatNumber';
import { solToLamports } from '@/lib/solana/connection';
import type { BountyMode } from '@/lib/types/bounty';

export default function PostBountyScreen() {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { post, pending } = useBountyEscrow();
    const [mode, setMode] = useState<BountyMode>('manual');
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [amountText, setAmountText] = useState('');

    const amountSol = parseSolAmount(amountText);
    const canSubmit =
        !pending &&
        title.trim().length > 0 &&
        prompt.trim().length > 0 &&
        amountSol !== null &&
        amountSol > 0;

    const onSubmit = async () => {
        if (!canSubmit || amountSol === null) return;
        try {
            haptic('medium');
            const bounty = await post({
                title: title.trim(),
                prompt: prompt.trim(),
                mode,
                bountyLamports: solToLamports(amountSol),
                scope: 'public',
                groupId: null,
            });
            haptic('heavy');
            await queryClient.invalidateQueries({ queryKey: qk.bounties.all() });
            toast.success('Bounty posted');
            router.replace(`/bounty/${bounty.id}`);
        } catch (err) {
            haptic('error');
            const msg = err instanceof Error ? err.message : 'Could not post bounty';
            toast.error(msg);
        }
    };

    return (
        <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
            <ScreenHeader title="Post a bounty" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 16,
                        paddingBottom: 240,
                        gap: 24,
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ alignItems: 'center', gap: 4 }}>
                        <SectionLabel label="REWARD" />
                        <NumberInput
                            value={amountText}
                            onChangeText={setAmountText}
                            placeholder="0"
                        />
                        <ThemedText type="body-sm" style={{ color: theme[500] }}>
                            {amountSol === null ? 'SOL' : `${formatSol(amountSol)} SOL`}
                        </ThemedText>
                    </View>

                    <View style={{ gap: 8 }}>
                        <SectionLabel label="MODE" />
                        <SegmentedToggle
                            tabs={['Manual', 'Auto'] as const}
                            activeTab={mode === 'manual' ? 'Manual' : 'Auto'}
                            onTabChange={(t) => setMode(t === 'Manual' ? 'manual' : 'auto')}
                            size="md"
                        />
                        <ThemedText type="caption" style={{ color: theme[500] }}>
                            {mode === 'manual'
                                ? 'You pick the winner from open submissions.'
                                : 'AI verifies submission photos against your prompt; first pass wins.'}
                        </ThemedText>
                    </View>

                    <View style={{ gap: 8 }}>
                        <SectionLabel label="TITLE" />
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Photo of a hand holding a yellow banana"
                            maxLength={80}
                        />
                    </View>

                    <View style={{ gap: 8 }}>
                        <SectionLabel label="PROMPT" />
                        <TextInput
                            value={prompt}
                            onChangeText={setPrompt}
                            placeholder="Describe exactly what counts as a valid submission."
                            multiline
                            numberOfLines={5}
                            maxLength={500}
                            style={{ height: 120, textAlignVertical: 'top' }}
                        />
                    </View>
                </ScrollView>

                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: 16,
                        paddingBottom: 16 + insets.bottom,
                        backgroundColor: theme[50],
                    }}
                >
                    <Button
                        size="lg"
                        variant="primary"
                        title={
                            pending
                                ? 'Posting...'
                                : amountSol && amountSol > 0
                                  ? `Post ${formatSol(amountSol)} SOL bounty`
                                  : 'Post bounty'
                        }
                        loading={pending}
                        disabled={!canSubmit}
                        onPress={onSubmit}
                    />
                </View>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

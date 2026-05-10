import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { NumberInput } from '@/components/ui/NumberInput';
import TextInput from '@/components/ui/TextInput';
import { useTheme } from '@/contexts/ThemeContext';
import { useBountyEscrow } from '@/hooks/useBountyEscrow';
import { qk } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { parseSolAmount, formatSol } from '@/lib/utils/formatNumber';
import { solToLamports } from '@/lib/solana/connection';
import type { BountyMode } from '@/lib/types/bounty';

interface PostBountySheetProps {
    visible: boolean;
    onClose: () => void;
}

export function PostBountySheet({ visible, onClose }: PostBountySheetProps) {
    const { theme } = useTheme();
    const queryClient = useQueryClient();
    const { post, pending } = useBountyEscrow();
    const [mode, setMode] = useState<BountyMode>('manual');
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [amountText, setAmountText] = useState('');

    // Reset on every open. The amount NumberInput auto-focuses below.
    useEffect(() => {
        if (!visible) return;
        setMode('manual');
        setTitle('');
        setPrompt('');
        setAmountText('');
    }, [visible]);

    const amountSol = parseSolAmount(amountText);
    const canSubmit =
        !pending &&
        title.trim().length > 0 &&
        prompt.trim().length > 0 &&
        amountSol !== null &&
        amountSol > 0;

    const onSubmit = async (close: (cb?: () => void) => void) => {
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
            close(() => {
                toast.success('Bounty posted');
                router.push(`/bounty/${bounty.id}`);
            });
        } catch (err) {
            haptic('error');
            toast.error(err instanceof Error ? err.message : 'Could not post bounty');
        }
    };

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            title="Post a bounty"
            height={520}
        >
            {({ close, keyboardVisible }) => (
                <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
                    {/* Reward — KPI-style at the top */}
                    <View style={{ alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                            <NumberInput
                                value={amountText}
                                onChangeText={setAmountText}
                                placeholder="0"
                                autoFocus
                                style={{ minWidth: 80, height: 64 }}
                                inputStyle={{ fontSize: 56, lineHeight: 60 }}
                            />
                            <ThemedText type="h4" style={{ color: theme[500] }}>
                                SOL
                            </ThemedText>
                        </View>
                    </View>

                    {/* Mode — single SegmentedToggle row */}
                    <View style={{ marginBottom: 12 }}>
                        <SegmentedToggle
                            tabs={['Manual', 'Auto'] as const}
                            activeTab={mode === 'manual' ? 'Manual' : 'Auto'}
                            onTabChange={(t) => setMode(t === 'Manual' ? 'manual' : 'auto')}
                            size="md"
                        />
                    </View>

                    {/* Title — single line */}
                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Bounty title"
                        maxLength={80}
                        returnKeyType="next"
                        style={{ marginBottom: 8 }}
                    />

                    {/* Prompt — collapsed multiline */}
                    <TextInput
                        value={prompt}
                        onChangeText={setPrompt}
                        placeholder={
                            mode === 'auto'
                                ? 'What does a winning photo show?'
                                : 'What counts as a valid submission?'
                        }
                        multiline
                        maxLength={300}
                        style={{ height: 72, textAlignVertical: 'top', marginBottom: 12 }}
                    />

                    {/* Primary CTA — bottom of sheet */}
                    <Button
                        size="lg"
                        variant="primary"
                        title={
                            pending
                                ? 'Posting…'
                                : amountSol && amountSol > 0
                                  ? `Post ${formatSol(amountSol)} SOL`
                                  : 'Post bounty'
                        }
                        loading={pending}
                        disabled={!canSubmit}
                        onPress={() => onSubmit(close)}
                    />
                </View>
            )}
        </BottomSheet>
    );
}

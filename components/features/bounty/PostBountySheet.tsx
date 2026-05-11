import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { NumberInput } from '@/components/ui/NumberInput';
import { SolanaIcon } from '@/components/ui/SolanaIcon';
import TextInput from '@/components/ui/TextInput';
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
    // Auto-shrink the KPI digits so long numbers never clip horizontally.
    // Geist digits at 56pt run ~33pt wide; the sheet body is ~360pt minus icon+gap.
    const amountFontSize = (() => {
        const len = Math.max(amountText.length || 1, 1);
        if (len <= 4) return 56;
        if (len <= 6) return 48;
        if (len <= 7) return 40;
        return 32;
    })();
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
            height={560}
            keyboardAware
        >
            {({ close }) => (
                <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 16 }}>
                    {/* Reward KPI — single horizontal group, auto-shrinks */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            paddingVertical: 8,
                        }}
                    >
                        <View style={{ flexShrink: 1, flexGrow: 0 }}>
                            <NumberInput
                                value={amountText}
                                onChangeText={setAmountText}
                                placeholder="0"
                                autoFocus
                                maxLength={9}
                                inputStyle={{
                                    fontSize: amountFontSize,
                                    lineHeight: Math.round(amountFontSize * 1.25),
                                    height: Math.round(amountFontSize * 1.4),
                                    minWidth: 0,
                                }}
                            />
                        </View>
                        <SolanaIcon size={Math.round(amountFontSize * 0.46)} />
                    </View>

                    <SegmentedToggle
                        tabs={['Manual', 'Auto'] as const}
                        activeTab={mode === 'manual' ? 'Manual' : 'Auto'}
                        onTabChange={(t) => setMode(t === 'Manual' ? 'manual' : 'auto')}
                        size="md"
                    />

                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Bounty title"
                        maxLength={80}
                        returnKeyType="next"
                        style={{ height: 48 }}
                    />

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
                        style={{ height: 88, textAlignVertical: 'top' }}
                    />

                    <View style={{ marginTop: 'auto' }}>
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
                </View>
            )}
        </BottomSheet>
    );
}

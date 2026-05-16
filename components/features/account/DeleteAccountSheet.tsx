import React from 'react';
import { ConfirmationSheet } from '@/components/ui/ConfirmationSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    submitting: boolean;
}

export function DeleteAccountSheet({ visible, onClose, onConfirm, submitting }: Props) {
    const { theme } = useTheme();
    return (
        <ConfirmationSheet
            visible={visible}
            onClose={onClose}
            onConfirm={onConfirm}
            submitting={submitting}
            title="Delete account"
            confirmTitle="Delete"
            height={400}
        >
            <ThemedText type="body-md" style={{ color: theme[700] }}>
                This permanently removes your profile, username, and active listings. Your past orders and applications stay on the books for the other side&apos;s records.
            </ThemedText>
            <ThemedText type="body-sm" style={{ color: theme[500] }}>
                On-chain transactions can&apos;t be undone. Withdraw any SOL from your wallet first.
            </ThemedText>
        </ConfirmationSheet>
    );
}

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

export function SignOutSheet({ visible, onClose, onConfirm, submitting }: Props) {
    const { theme } = useTheme();
    return (
        <ConfirmationSheet
            visible={visible}
            onClose={onClose}
            onConfirm={onConfirm}
            submitting={submitting}
            title="Sign out"
            confirmTitle="Sign out"
        >
            <ThemedText type="body-md" align="center" style={{ color: theme[700] }}>
                Sign out of Adler? You&apos;ll need to sign back in to see your wallet, listings, and orders.
            </ThemedText>
        </ConfirmationSheet>
    );
}

import React, { type ReactNode } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';

interface ConfirmationSheetProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    confirmTitle: string;
    submitting?: boolean;
    height?: number;
    children: ReactNode;
}

export function ConfirmationSheet({
    visible,
    onClose,
    onConfirm,
    title,
    confirmTitle,
    submitting = false,
    height = 300,
    children,
}: ConfirmationSheetProps) {
    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            title={title}
            height={height}
            dismissible={!submitting}
        >
            {({ close }) => (
                <View style={{ gap: 20 }}>
                    {children}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Button
                            title="Cancel"
                            onPress={() => close()}
                            variant="secondary"
                            className="flex-1"
                            disabled={submitting}
                        />
                        <Button
                            title={confirmTitle}
                            onPress={onConfirm}
                            variant="destructive"
                            loading={submitting}
                            disabled={submitting}
                            className="flex-1"
                        />
                    </View>
                </View>
            )}
        </BottomSheet>
    );
}

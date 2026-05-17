import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { getConnection } from '@/lib/solana/connection';
import { SOLANA_NETWORK, SOLANA_RPC_URL } from '@/lib/constants/featureGates';
import { Status } from '@/constants/StatusColors';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const NETWORK_LABEL: Record<string, string> = {
    'devnet': 'Devnet',
    'mainnet-beta': 'Mainnet',
    'testnet': 'Testnet',
};

function rpcLabel(url: string): string {
    if (url.includes('cloudfunctions.net') || url.includes('solanaRpcProxy')) {
        return 'Helius';
    }
    if (url.includes('helius')) return 'Helius';
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

export function ConnectivitySheet({ visible, onClose }: Props) {
    const { theme } = useTheme();

    const pingQuery = useQuery({
        queryKey: ['solana', 'ping', SOLANA_RPC_URL],
        enabled: visible,
        // Treat a fresh ping as good for 4s — re-opening the sheet within
        // that window uses the cached result instead of re-pinging.
        staleTime: 4_000,
        refetchInterval: visible ? 5_000 : false,
        queryFn: async () => {
            const start = Date.now();
            const slot = await getConnection().getSlot('confirmed');
            return { latencyMs: Date.now() - start, slot };
        },
    });

    const connected = !!pingQuery.data && !pingQuery.isError;
    const statusColor = pingQuery.isLoading
        ? theme[400]
        : connected
            ? Status.success
            : Status.error;
    const statusLabel = pingQuery.isLoading ? 'Checking…' : connected ? 'Connected' : 'Unreachable';

    return (
        <BottomSheet visible={visible} onClose={onClose} title="Connectivity" height={420}>
            {() => (
                <View style={{ gap: 16 }}>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            paddingVertical: 14,
                            paddingHorizontal: 8,
                            borderRadius: 14,
                            backgroundColor: theme[100],
                        }}
                    >
                        <View
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: statusColor,
                            }}
                        />
                        <ThemedText type="body-md-semibold" style={{ color: theme[950] }}>
                            {statusLabel}
                        </ThemedText>
                        {pingQuery.data ? (
                            <ThemedText type="caption" style={{ color: theme[500], marginLeft: 'auto' }}>
                                {pingQuery.data.latencyMs} ms
                            </ThemedText>
                        ) : null}
                    </View>

                    <Row label="Network" value={NETWORK_LABEL[SOLANA_NETWORK] ?? SOLANA_NETWORK} />
                    <Row label="RPC" value={rpcLabel(SOLANA_RPC_URL)} mono />
                    {pingQuery.data ? (
                        <Row label="Current slot" value={pingQuery.data.slot.toLocaleString()} mono />
                    ) : null}
                </View>
            )}
        </BottomSheet>
    );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    const { theme } = useTheme();
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: theme[100],
            }}
        >
            <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                {label}
            </ThemedText>
            <ThemedText
                type="body-sm-semibold"
                style={{ color: theme[950], maxWidth: '70%', textAlign: 'right' }}
                numberOfLines={1}
            >
                {value}
            </ThemedText>
        </View>
    );
}

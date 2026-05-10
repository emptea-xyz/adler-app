import React, { useState } from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
// KPI was deleted in the bounty pivot; we render the balance inline below.
import { ReceiveSheet } from './ReceiveSheet';
import { SendSheet } from './SendSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getConnection, lamportsToSol } from '@/lib/solana/connection';
import { qk } from '@/lib/constants/queryKeys';
import { SOLANA_NETWORK } from '@/lib/constants/featureGates';
import { haptic } from '@/lib/utils/haptic';
import { formatSol } from '@/lib/utils/formatNumber';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

function ActionButton({ icon, label, onPress }: ActionButtonProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={{
        flex: 1,
        backgroundColor: theme[950],
        borderRadius: 12,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
      }}
    >
      {icon}
      <ThemedText type="body-lg-semibold" style={{ color: theme[50] }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function WalletSheet({ visible, onClose }: Props) {
  const { walletAddress } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const balanceQuery = useQuery({
    queryKey: walletAddress ? qk.wallet.balance(walletAddress) : ['wallet', 'balance', 'none'],
    enabled: !!walletAddress && visible,
    queryFn: async () => {
      if (!walletAddress) return 0;
      const lamports = await getConnection().getBalance(new PublicKey(walletAddress));
      return lamportsToSol(lamports);
    },
    refetchInterval: visible ? 30_000 : false,
    staleTime: 15_000,
  });

  const refresh = () => {
    if (!walletAddress) return;
    haptic('light');
    queryClient.invalidateQueries({ queryKey: qk.wallet.balance(walletAddress) });
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title={`Wallet · ${SOLANA_NETWORK}`}
        height={400}
      >
        {() => (
          <View style={{ gap: 24, alignItems: 'center' }}>
            <View style={{ alignItems: 'center', gap: 4, marginTop: 8 }}>
              {balanceQuery.isLoading || balanceQuery.data === undefined ? (
                <ActivityIndicator color={theme[500]} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <ThemedText type="h1" style={{ color: theme[950] }}>
                    {formatSol(balanceQuery.data)}
                  </ThemedText>
                  <ThemedText type="body-md-semibold" style={{ color: theme[500] }}>
                    SOL
                  </ThemedText>
                </View>
              )}
              <Pressable
                onPress={refresh}
                hitSlop={8}
                disabled={balanceQuery.isFetching}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}
              >
                {balanceQuery.isFetching ? (
                  <ActivityIndicator size="small" color={theme[500]} />
                ) : (
                  <RefreshCw color={theme[500]} size={12} />
                )}
                <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
                  Refresh
                </ThemedText>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <ActionButton
                icon={<ArrowUpRight size={18} color={theme[50]} strokeWidth={2.25} />}
                label="Send"
                onPress={() => setSendOpen(true)}
              />
              <ActionButton
                icon={<ArrowDownLeft size={18} color={theme[50]} strokeWidth={2.25} />}
                label="Receive"
                onPress={() => setReceiveOpen(true)}
              />
            </View>
          </View>
        )}
      </BottomSheet>

      <SendSheet visible={sendOpen} onClose={() => setSendOpen(false)} />
      <ReceiveSheet
        visible={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        walletAddress={walletAddress}
      />
    </>
  );
}

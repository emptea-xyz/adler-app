import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { PublicKey } from '@solana/web3.js';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { transferSol } from '@/lib/solana/transferSol';
import { qk } from '@/lib/constants/queryKeys';
import { SOLANA_NETWORK } from '@/lib/constants/featureGates';
import { ACCENT_COLORS } from '@/constants/ThemePalettes';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { formatSol, parseSolAmount } from '@/lib/utils/formatNumber';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function isValidSolanaAddress(value: string): boolean {
  if (!value) return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <ThemedText type="caption-semibold" style={{ color: theme[500] }}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

export function SendSheet({ visible, onClose }: Props) {
  const { walletAddress } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const solana = useEmbeddedSolanaWallet();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setRecipient('');
      setAmount('');
      setSubmitting(false);
    }
  }, [visible]);

  const recipientValid = recipient.trim().length === 0 || isValidSolanaAddress(recipient.trim());
  const parsedAmount = parseSolAmount(amount);
  const amountValid = parsedAmount !== null && parsedAmount > 0;
  const canSend =
    !submitting &&
    !!walletAddress &&
    isValidSolanaAddress(recipient.trim()) &&
    amountValid;

  const send = useCallback(
    async (closeFn: () => void) => {
      const wallet = solana.wallets?.[0];
      if (!wallet || !walletAddress) {
        toast.error('Wallet not ready');
        return;
      }
      if (!isValidSolanaAddress(recipient.trim())) {
        toast.error('Recipient address is invalid');
        return;
      }
      if (!amountValid || parsedAmount === null) {
        toast.error('Enter a valid SOL amount');
        return;
      }
      haptic('medium');
      setSubmitting(true);
      try {
        const provider = await wallet.getProvider();
        const signature = await transferSol({
          provider,
          fromAddress: walletAddress,
          toAddress: recipient.trim(),
          amountSol: parsedAmount,
        });
        queryClient.invalidateQueries({ queryKey: qk.wallet.balance(walletAddress) });
        haptic('heavy');
        toast.success(`Sent · tx ${signature.slice(0, 8)}…`);
        closeFn();
      } catch (err: any) {
        toast.error(err?.message ?? 'Transfer failed');
        setSubmitting(false);
      }
    },
    [solana, walletAddress, recipient, parsedAmount, amountValid, queryClient],
  );

  const isDevnet = SOLANA_NETWORK === 'devnet';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Send SOL"
      height={520}
      keyboardAware
      dismissible={!submitting}
    >
      {({ close }) => (
        <View style={{ gap: 16 }}>
          <ThemedText
            type="body-sm"
            style={{ color: isDevnet ? ACCENT_COLORS.pink : theme[500] }}
          >
            {isDevnet
              ? 'Devnet · this is test SOL, not real funds.'
              : `${SOLANA_NETWORK} · this is a real on-chain transfer.`}
          </ThemedText>

          <Field label="Recipient address">
            <TextInput
              value={recipient}
              onChangeText={setRecipient}
              placeholder="8ZpQ…r4xK"
              autoCapitalize="none"
              autoCorrect={false}
              error={recipient.length > 0 && !recipientValid}
            />
          </Field>

          <Field label="Amount (SOL)">
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.5"
              keyboardType="decimal-pad"
            />
          </Field>

          <Button
            title={submitting ? 'Sending…' : `Send ${parsedAmount !== null && amountValid ? formatSol(parsedAmount) + ' ' : ''}SOL`}
            onPress={() => send(close)}
            disabled={!canSend}
            loading={submitting}
            variant="primary"
            size="lg"
            className="w-full"
          />

          {!walletAddress ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={theme[500]} />
              <ThemedText type="body-sm" style={{ color: theme[500] }}>
                Waiting for wallet…
              </ThemedText>
            </View>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

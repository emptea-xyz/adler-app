import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { PublicKey } from '@solana/web3.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ThemedText } from '@/components/base/ThemedText';
import { Button } from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { transferSolLamports } from '@/lib/solana/transferSol';
import { qk } from '@/lib/constants/queryKeys';
import { SOLANA_NETWORK } from '@/lib/constants/featureGates';
import { Status } from '@/constants/StatusColors';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import { formatSol, parseSolAmount } from '@/lib/utils/formatNumber';
import { getConnection, lamportsToSol } from '@/lib/solana/connection';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// Reserve a small lamport buffer for the transaction signature fee +
// any account-creation rent the recipient might trigger. Keeps "Send max"
// from creating a tx the network will reject for insufficient funds.
const FEE_RESERVE_LAMPORTS = 5000;

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
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!visible) {
      setRecipient('');
      setAmount('');
      setSubmitting(false);
      setConfirming(false);
    }
  }, [visible]);

  // Balance is reused for the > balance guard and the "Send max" helper.
  // Lightweight: the wallet screen already keeps it warm under the same
  // key on a 30s refetch interval.
  const balanceQuery = useQuery({
    queryKey: walletAddress ? qk.wallet.balance(walletAddress) : ['wallet', 'balance', 'none'],
    enabled: !!walletAddress && visible,
    queryFn: async () => {
      if (!walletAddress) return 0;
      const lamports = await getConnection().getBalance(new PublicKey(walletAddress));
      return lamports;
    },
    staleTime: 15_000,
  });
  const balanceLamports = balanceQuery.data ?? 0;

  const recipientTrimmed = recipient.trim();
  const isSelfSend = !!walletAddress && recipientTrimmed === walletAddress;
  const recipientValid =
    recipientTrimmed.length === 0 ||
    (isValidSolanaAddress(recipientTrimmed) && !isSelfSend);
  const parsedAmount = parseSolAmount(amount);
  const amountLamports = parsedAmount !== null ? Math.round(parsedAmount * LAMPORTS_PER_SOL) : 0;
  const amountValid = parsedAmount !== null && parsedAmount > 0;
  const exceedsBalance =
    amountValid && amountLamports + FEE_RESERVE_LAMPORTS > balanceLamports;
  const canSend =
    !submitting &&
    !confirming &&
    !!walletAddress &&
    isValidSolanaAddress(recipientTrimmed) &&
    !isSelfSend &&
    amountValid &&
    !exceedsBalance;

  const setMaxAmount = useCallback(() => {
    if (!balanceLamports) return;
    const max = Math.max(0, balanceLamports - FEE_RESERVE_LAMPORTS);
    if (max <= 0) return;
    const sol = lamportsToSol(max);
    // Trim trailing zeros for a clean prefill.
    setAmount(parseFloat(sol.toFixed(9)).toString());
  }, [balanceLamports]);

  const send = useCallback(
    async (closeFn: () => void) => {
      const wallet = solana.wallets?.[0];
      if (!wallet || !walletAddress) {
        toast.error('Wallet not ready');
        return;
      }
      if (!isValidSolanaAddress(recipientTrimmed)) {
        toast.error('Recipient address is invalid');
        return;
      }
      if (isSelfSend) {
        toast.error("You can't send SOL to your own address.");
        return;
      }
      if (!amountValid || parsedAmount === null) {
        toast.error('Enter a valid SOL amount');
        return;
      }
      if (exceedsBalance) {
        toast.error('Amount exceeds your balance (including fees).');
        return;
      }
      haptic('medium');
      setSubmitting(true);
      try {
        const provider = await wallet.getProvider();
        const signature = await transferSolLamports({
          provider,
          fromAddress: walletAddress,
          toAddress: recipientTrimmed,
          amountLamports,
        });

        // Wait for confirmation before invalidating the balance so the
        // refetch returns the post-tx balance, not the stale pre-tx one.
        setSubmitting(false);
        setConfirming(true);
        try {
          await getConnection().confirmTransaction(signature, 'confirmed');
        } catch (confErr) {
          if (__DEV__) console.warn('confirmTransaction failed', confErr);
        }
        queryClient.invalidateQueries({ queryKey: qk.wallet.balance(walletAddress) });
        haptic('heavy');
        toast.success(`Sent · tx ${signature.slice(0, 8)}…`);
        closeFn();
      } catch (err: any) {
        toast.error(err?.message ?? 'Transfer failed');
        setSubmitting(false);
        setConfirming(false);
      }
    },
    [
      solana,
      walletAddress,
      recipientTrimmed,
      isSelfSend,
      parsedAmount,
      amountLamports,
      amountValid,
      exceedsBalance,
      queryClient,
    ],
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
            style={{ color: isDevnet ? Status.warning : theme[500] }}
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
            {recipientTrimmed.length > 0 && isSelfSend ? (
              <ThemedText type="caption" style={{ color: Status.error }}>
                You can't send SOL to your own address.
              </ThemedText>
            ) : null}
          </Field>

          <Field label="Amount (SOL)">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.5"
                  keyboardType="decimal-pad"
                  error={exceedsBalance}
                />
              </View>
              <Pressable
                onPress={setMaxAmount}
                disabled={!walletAddress || balanceLamports <= FEE_RESERVE_LAMPORTS}
                hitSlop={8}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme[200],
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <ThemedText type="body-sm-semibold" style={{ color: theme[950] }}>
                  Max
                </ThemedText>
              </Pressable>
            </View>
            {balanceQuery.data !== undefined ? (
              <ThemedText type="caption" style={{ color: exceedsBalance ? Status.error : theme[500] }}>
                {exceedsBalance
                  ? `Exceeds balance (${formatSol(lamportsToSol(balanceLamports))} SOL available, fee ~${formatSol(lamportsToSol(FEE_RESERVE_LAMPORTS))})`
                  : `Balance: ${formatSol(lamportsToSol(balanceLamports))} SOL`}
              </ThemedText>
            ) : null}
          </Field>

          <Button
            title={
              confirming
                ? 'Confirming…'
                : submitting
                  ? 'Sending…'
                  : `Send ${parsedAmount !== null && amountValid ? formatSol(parsedAmount) + ' ' : ''}SOL`
            }
            onPress={() => send(close)}
            disabled={!canSend}
            loading={submitting || confirming}
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

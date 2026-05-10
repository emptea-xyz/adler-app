import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { WalletSheet } from '@/components/features/wallet/WalletSheet';

// Globally-mounted sheets that any screen can trigger.
// - openWallet: every WalletPill across the app opens the wallet sheet
//   (balance + Send + Receive). The wallet sheet itself manages the nested
//   Send / Receive sub-sheets.

interface OverlaySheetsContextValue {
  openWallet: () => void;
  closeWallet: () => void;
}

const OverlaySheetsContext = createContext<OverlaySheetsContextValue | null>(null);

export function OverlaySheetsProvider({ children }: { children: React.ReactNode }) {
  const [walletVisible, setWalletVisible] = useState(false);

  const openWallet = useCallback(() => setWalletVisible(true), []);
  const closeWallet = useCallback(() => setWalletVisible(false), []);

  const value = useMemo<OverlaySheetsContextValue>(
    () => ({ openWallet, closeWallet }),
    [openWallet, closeWallet],
  );

  return (
    <OverlaySheetsContext.Provider value={value}>
      {children}
      <WalletSheet visible={walletVisible} onClose={closeWallet} />
    </OverlaySheetsContext.Provider>
  );
}

export function useOverlaySheets(): OverlaySheetsContextValue {
  const ctx = useContext(OverlaySheetsContext);
  if (!ctx) {
    throw new Error('useOverlaySheets must be used within OverlaySheetsProvider');
  }
  return ctx;
}

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { WalletSheet } from '@/components/features/wallet/WalletSheet';
import { PostBountySheet } from '@/components/features/bounty/PostBountySheet';

// Globally-mounted sheets that any screen can trigger.
// - openWallet: every WalletPill across the app opens the wallet sheet
//   (balance + Send + Receive). The wallet sheet itself manages the nested
//   Send / Receive sub-sheets.
// - openPostBounty: tab bar's center upload-arrow opens the bounty post
//   sheet — the fastest path from anywhere in the app to a live bounty.

interface OverlaySheetsContextValue {
  openWallet: () => void;
  closeWallet: () => void;
  openPostBounty: () => void;
  closePostBounty: () => void;
}

const OverlaySheetsContext = createContext<OverlaySheetsContextValue | null>(null);

export function OverlaySheetsProvider({ children }: { children: React.ReactNode }) {
  const [walletVisible, setWalletVisible] = useState(false);
  const [postBountyVisible, setPostBountyVisible] = useState(false);

  const openWallet = useCallback(() => setWalletVisible(true), []);
  const closeWallet = useCallback(() => setWalletVisible(false), []);
  const openPostBounty = useCallback(() => setPostBountyVisible(true), []);
  const closePostBounty = useCallback(() => setPostBountyVisible(false), []);

  const value = useMemo<OverlaySheetsContextValue>(
    () => ({ openWallet, closeWallet, openPostBounty, closePostBounty }),
    [openWallet, closeWallet, openPostBounty, closePostBounty],
  );

  return (
    <OverlaySheetsContext.Provider value={value}>
      {children}
      <WalletSheet visible={walletVisible} onClose={closeWallet} />
      <PostBountySheet visible={postBountyVisible} onClose={closePostBounty} />
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

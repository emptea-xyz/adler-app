import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CreateSheet } from '@/components/features/create/CreateSheet';
import { RoleSwitchSheet } from '@/components/features/role/RoleSwitchSheet';
import { WalletSheet } from '@/components/features/wallet/WalletSheet';

// Globally-mounted sheets that any screen can trigger.
// - openCreate: tab bar's center upload arrow opens the create form sheet.
// - openRoleSwitch: profile's role chip + settings row open the role-switch
//   sheet without a navigation jump.
// - openWallet: every WalletPill across the app opens the wallet sheet
//   (balance + Send + Receive). The wallet sheet itself manages the nested
//   Send / Receive sub-sheets.

interface OverlaySheetsContextValue {
  openCreate: () => void;
  closeCreate: () => void;
  openRoleSwitch: () => void;
  closeRoleSwitch: () => void;
  openWallet: () => void;
  closeWallet: () => void;
}

const OverlaySheetsContext = createContext<OverlaySheetsContextValue | null>(null);

export function OverlaySheetsProvider({ children }: { children: React.ReactNode }) {
  const [createVisible, setCreateVisible] = useState(false);
  const [roleSwitchVisible, setRoleSwitchVisible] = useState(false);
  const [walletVisible, setWalletVisible] = useState(false);

  const openCreate = useCallback(() => setCreateVisible(true), []);
  const closeCreate = useCallback(() => setCreateVisible(false), []);
  const openRoleSwitch = useCallback(() => setRoleSwitchVisible(true), []);
  const closeRoleSwitch = useCallback(() => setRoleSwitchVisible(false), []);
  const openWallet = useCallback(() => setWalletVisible(true), []);
  const closeWallet = useCallback(() => setWalletVisible(false), []);

  const value = useMemo<OverlaySheetsContextValue>(
    () => ({
      openCreate,
      closeCreate,
      openRoleSwitch,
      closeRoleSwitch,
      openWallet,
      closeWallet,
    }),
    [openCreate, closeCreate, openRoleSwitch, closeRoleSwitch, openWallet, closeWallet],
  );

  return (
    <OverlaySheetsContext.Provider value={value}>
      {children}
      <CreateSheet visible={createVisible} onClose={closeCreate} />
      <RoleSwitchSheet visible={roleSwitchVisible} onClose={closeRoleSwitch} />
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

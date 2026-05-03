import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CreateSheet } from '@/components/features/create/CreateSheet';
import { RoleSwitchSheet } from '@/components/features/role/RoleSwitchSheet';

// Globally-mounted sheets that any screen can trigger.
// - openCreate: tab bar's center upload arrow opens the create form sheet.
// - openRoleSwitch: profile's role chip + settings row open the role-switch
//   sheet without a navigation jump.

interface OverlaySheetsContextValue {
  openCreate: () => void;
  closeCreate: () => void;
  openRoleSwitch: () => void;
  closeRoleSwitch: () => void;
}

const OverlaySheetsContext = createContext<OverlaySheetsContextValue | null>(null);

export function OverlaySheetsProvider({ children }: { children: React.ReactNode }) {
  const [createVisible, setCreateVisible] = useState(false);
  const [roleSwitchVisible, setRoleSwitchVisible] = useState(false);

  const openCreate = useCallback(() => setCreateVisible(true), []);
  const closeCreate = useCallback(() => setCreateVisible(false), []);
  const openRoleSwitch = useCallback(() => setRoleSwitchVisible(true), []);
  const closeRoleSwitch = useCallback(() => setRoleSwitchVisible(false), []);

  const value = useMemo<OverlaySheetsContextValue>(
    () => ({ openCreate, closeCreate, openRoleSwitch, closeRoleSwitch }),
    [openCreate, closeCreate, openRoleSwitch, closeRoleSwitch],
  );

  return (
    <OverlaySheetsContext.Provider value={value}>
      {children}
      <CreateSheet visible={createVisible} onClose={closeCreate} />
      <RoleSwitchSheet visible={roleSwitchVisible} onClose={closeRoleSwitch} />
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

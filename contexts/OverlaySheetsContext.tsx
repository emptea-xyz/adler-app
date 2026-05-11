import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { PostBountySheet } from '@/components/features/bounty/PostBountySheet';

// Globally-mounted sheet that any screen can trigger.
// - openPostBounty: tab bar's center upload-arrow opens the bounty post
//   sheet — the fastest path from anywhere in the app to a live bounty.

interface OverlaySheetsContextValue {
  openPostBounty: () => void;
  closePostBounty: () => void;
}

const OverlaySheetsContext = createContext<OverlaySheetsContextValue | null>(null);

export function OverlaySheetsProvider({ children }: { children: React.ReactNode }) {
  const [postBountyVisible, setPostBountyVisible] = useState(false);

  const openPostBounty = useCallback(() => setPostBountyVisible(true), []);
  const closePostBounty = useCallback(() => setPostBountyVisible(false), []);

  const value = useMemo<OverlaySheetsContextValue>(
    () => ({ openPostBounty, closePostBounty }),
    [openPostBounty, closePostBounty],
  );

  return (
    <OverlaySheetsContext.Provider value={value}>
      {children}
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

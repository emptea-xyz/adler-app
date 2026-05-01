/**
 * HapticRefreshControl - RefreshControl wrapper that fires a light haptic on pull.
 */
import React, { useCallback } from "react";
import { RefreshControl, type RefreshControlProps } from "react-native";
import { haptic } from "@/lib/utils/haptic";

export function HapticRefreshControl({ onRefresh, ...props }: RefreshControlProps) {
  const handleRefresh = useCallback(() => {
    haptic("light");
    onRefresh?.();
  }, [onRefresh]);

  return <RefreshControl {...props} onRefresh={handleRefresh} />;
}

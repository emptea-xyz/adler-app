import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ThemedText } from '@/components/base/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { updateGig, updateService } from '@/lib/services/listingsService';
import { qk, FEED_KEYS } from '@/lib/constants/queryKeys';
import { toast } from '@/lib/utils/toast';
import { haptic } from '@/lib/utils/haptic';
import type { GigStatus, ServiceStatus } from '@/types/marketplace';

type Action =
  | { kind: 'service'; next: ServiceStatus; label: string; success: string }
  | { kind: 'gig'; next: GigStatus; label: string; success: string };

interface ServiceProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Legacy prop name — `'package'` is mapped to v1 `'service'` internally.
   * Kept so existing callers compile; step-2 UI rewrite swaps it.
   */
  kind: 'package' | 'service';
  id: string;
  status: ServiceStatus;
  ownerId: string;
}
interface GigProps {
  visible: boolean;
  onClose: () => void;
  kind: 'gig';
  id: string;
  status: GigStatus;
  ownerId: string;
}
type Props = ServiceProps | GigProps;

function serviceActions(status: ServiceStatus): Action[] {
  if (status === 'active') {
    return [
      { kind: 'service', next: 'paused', label: 'Pause listing', success: 'Listing paused' },
      { kind: 'service', next: 'sold', label: 'Mark as sold', success: 'Marked as sold' },
    ];
  }
  if (status === 'paused') {
    return [
      { kind: 'service', next: 'active', label: 'Resume listing', success: 'Listing resumed' },
      { kind: 'service', next: 'sold', label: 'Mark as sold', success: 'Marked as sold' },
    ];
  }
  // 'sold' is terminal — keep an unhide path in case the seller mis-clicked.
  return [
    { kind: 'service', next: 'active', label: 'Re-list as active', success: 'Listing is active again' },
  ];
}

function gigActions(status: GigStatus): Action[] {
  if (status === 'open') {
    return [{ kind: 'gig', next: 'closed', label: 'Close gig', success: 'Gig closed' }];
  }
  if (status === 'closed') {
    return [{ kind: 'gig', next: 'open', label: 'Re-open gig', success: 'Gig reopened' }];
  }
  // 'awarded' is terminal — payment is locked in, no further transitions.
  return [];
}

export function ManageListingSheet(props: Props) {
  const { visible, onClose, kind, id, status, ownerId } = props;
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const isService = kind === 'package' || kind === 'service';

  const actions: Action[] = isService
    ? serviceActions(status as ServiceStatus)
    : gigActions(status as GigStatus);

  const onAction = useCallback(
    async (action: Action) => {
      haptic('medium');
      setPending(action.label);
      try {
        if (action.kind === 'service') {
          await updateService(id, { status: action.next });
          queryClient.invalidateQueries({ queryKey: qk.listings.detail('service', id) });
          queryClient.invalidateQueries({ queryKey: qk.listings.byOwner('service', ownerId) });
        } else {
          await updateGig(id, { status: action.next });
          queryClient.invalidateQueries({ queryKey: qk.listings.detail('gig', id) });
          queryClient.invalidateQueries({ queryKey: qk.listings.byOwner('gig', ownerId) });
        }
        queryClient.invalidateQueries({ queryKey: FEED_KEYS.browse() });
        toast.success(action.success);
        onClose();
      } catch (err: any) {
        toast.error(err?.message ?? 'Update failed');
      } finally {
        setPending(null);
      }
    },
    [id, ownerId, queryClient, onClose],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isService ? 'Manage service' : 'Manage gig'}
      height={actions.length === 0 ? 240 : 200 + actions.length * 60}
      dismissible={!pending}
    >
      {() => (
        <View style={{ gap: 12 }}>
          {actions.length === 0 ? (
            <ThemedText type="body-md" style={{ color: theme[500] }}>
              No actions available — this listing is in a terminal state.
            </ThemedText>
          ) : (
            actions.map((a) => (
              <Button
                key={a.label}
                title={a.label}
                onPress={() => onAction(a)}
                loading={pending === a.label}
                disabled={!!pending}
                variant={a.next === 'sold' || a.next === 'closed' ? 'destructive' : 'secondary'}
                size="lg"
                className="w-full"
              />
            ))
          )}
        </View>
      )}
    </BottomSheet>
  );
}

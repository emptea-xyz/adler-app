import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { qk } from '@/lib/constants/queryKeys';
import { markOrderPaid } from '@/lib/services/ordersService';
import { clearPendingOrder, listPendingOrders } from '@/lib/utils/pendingOrders';
import { retryWithBackoff } from '@/lib/utils/retry';
import { toast } from '@/lib/utils/toast';

export function RecoverPendingOrders() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        (async () => {
            const pending = await listPendingOrders();
            for (const row of pending) {
                if (cancelled) return;
                if (!row.signature) continue;
                try {
                    await retryWithBackoff(
                        () => markOrderPaid(row.orderId, row.signature as string),
                        { tries: 3, baseMs: 500 },
                    );
                    await clearPendingOrder(row.orderId);
                } catch {
                    toast.info('Finalizing one payment in background.');
                }
            }
            await queryClient.invalidateQueries({ queryKey: qk.orders.byBuyer(user.id) });
            await queryClient.invalidateQueries({ queryKey: qk.threads.byParticipant(user.id) });
        })();
        return () => {
            cancelled = true;
        };
    }, [queryClient, user]);

    return null;
}

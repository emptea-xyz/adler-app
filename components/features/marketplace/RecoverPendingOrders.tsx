import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { useAuth } from '@/contexts/AuthContext';
import { qk } from '@/lib/constants/queryKeys';
import { getConnection } from '@/lib/solana/connection';
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
                let signature = row.signature;
                if (!signature) {
                    const escrowPda = new PublicKey(row.escrowPda);
                    const funded = await getConnection().getAccountInfo(escrowPda);
                    if (!funded) continue;
                    signature = await getConnection()
                        .getSignaturesForAddress(escrowPda, { limit: 1 })
                        .then((rows) => rows[0]?.signature ?? null)
                        .catch(() => null);
                    if (!signature) continue;
                }
                try {
                    await retryWithBackoff(
                        () => markOrderPaid(row.orderId, signature as string),
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

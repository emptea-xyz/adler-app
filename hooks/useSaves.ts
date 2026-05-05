import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
    addSave,
    listSavesForUser,
    removeSave,
} from '@/lib/services/saveService';
import { SAVE_KEYS } from '@/lib/constants/queryKeys';
import type { Save, SavedKind } from '@/types/marketplace';

interface UseSavesResult {
    saves: Save[];
    isLoading: boolean;
    isSaved: (kind: SavedKind, id: string) => boolean;
    toggle: (kind: SavedKind, id: string) => void;
    isPending: (kind: SavedKind, id: string) => boolean;
}

/**
 * One source of truth for the user's saved listings, shared across Browse,
 * Saved, and detail screens. The mutation is optimistic — the heart toggles
 * instantly and the server write reconciles in the background.
 */
export function useSaves(): UseSavesResult {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const queryKey = user ? SAVE_KEYS.byUser(user.id) : ['saves', 'user', 'anon'];

    const { data, isLoading } = useQuery({
        queryKey,
        enabled: !!user,
        queryFn: () => listSavesForUser(user!.id),
    });

    const saves = useMemo(() => data ?? [], [data]);

    const savedSet = useMemo(
        () => new Set(saves.map((s) => `${s.kind}:${s.listingId}`)),
        [saves],
    );

    const mutation = useMutation({
        mutationFn: async ({ kind, id, currentlySaved }: { kind: SavedKind; id: string; currentlySaved: boolean }) => {
            if (currentlySaved) await removeSave(kind, id);
            else await addSave(kind, id);
        },
        onMutate: async ({ kind, id, currentlySaved }) => {
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<Save[]>(queryKey) ?? [];
            const next = currentlySaved
                ? previous.filter((s) => !(s.kind === kind && s.listingId === id))
                : [
                      {
                          id: `optimistic_${kind}_${id}`,
                          userId: user?.id ?? '',
                          kind,
                          listingId: id,
                          createdAt: Date.now(),
                      },
                      ...previous,
                  ];
            queryClient.setQueryData(queryKey, next);
            return { previous };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });

    const isSaved = useCallback(
        (kind: SavedKind, id: string) => savedSet.has(`${kind}:${id}`),
        [savedSet],
    );

    const toggle = useCallback(
        (kind: SavedKind, id: string) => {
            if (!user) return;
            mutation.mutate({ kind, id, currentlySaved: isSaved(kind, id) });
        },
        [user, mutation, isSaved],
    );

    const isPending = useCallback(
        (kind: SavedKind, id: string) =>
            mutation.isPending &&
            mutation.variables?.kind === kind &&
            mutation.variables?.id === id,
        [mutation.isPending, mutation.variables],
    );

    return { saves, isLoading, isSaved, toggle, isPending };
}

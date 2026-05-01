/**
 * useAsyncState - Unify loading state from multiple TanStack Query results.
 *
 * Combines multiple useQuery results into a single loading state:
 * - All loading → 'loading'
 * - Any error → 'error'
 * - All data ready → 'ready'
 *
 * Only considers initial load - background refetches don't trigger 'loading'.
 */
import { UseQueryResult } from '@tanstack/react-query';
import { AsyncState } from '@/components/ui/FadeTransition';

interface AsyncStateResult {
    /** Combined state from all queries */
    state: AsyncState;
    /** First error encountered (if any) */
    error: Error | null;
    /** Whether any query is currently fetching (including background) */
    isFetching: boolean;
}

/**
 * Combines multiple TanStack Query results into a unified loading state.
 *
 * @param queries - Array of useQuery results to combine
 * @returns Combined state, error, and fetching status
 *
 * @example
 * const profileQuery = useQuery({ queryKey: ['profile'], queryFn: getProfile });
 * const statsQuery = useQuery({ queryKey: ['stats'], queryFn: getStats });
 * const { state, error } = useAsyncState([profileQuery, statsQuery]);
 */
export function useAsyncState(
    queries: Pick<UseQueryResult, 'isLoading' | 'isError' | 'error' | 'isFetching'>[]
): AsyncStateResult {
    // Check if any query is in initial loading state
    // Note: isLoading is true only when loading AND no data exists (initial fetch)
    const isLoading = queries.some((q) => q.isLoading);

    // Check if any query has an error
    const isError = queries.some((q) => q.isError);

    // Get first error for display
    const error = queries.find((q) => q.error)?.error as Error | null;

    // Check if any query is fetching (includes background refetches)
    const isFetching = queries.some((q) => q.isFetching);

    // Determine state
    let state: AsyncState;
    if (isError) {
        state = 'error';
    } else if (isLoading) {
        state = 'loading';
    } else {
        state = 'ready';
    }

    return { state, error, isFetching };
}

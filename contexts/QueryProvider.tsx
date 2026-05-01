import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import React, { ReactNode, useEffect } from 'react';
import { USE_DEV_DATA } from '@/lib/constants/featureGates';

// Create a client with optimized defaults for mobile.
// In dev mode, disable all refetching so seeded mock data is never replaced
// by failed Firebase calls.
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: USE_DEV_DATA ? Infinity : 5 * 60 * 1000,
            gcTime: USE_DEV_DATA ? Infinity : 30 * 60 * 1000,
            retry: USE_DEV_DATA ? false : 2,
            refetchOnWindowFocus: false,
            refetchOnReconnect: !USE_DEV_DATA,
            refetchOnMount: USE_DEV_DATA ? false : true,
            networkMode: 'offlineFirst',
        },
        mutations: {
            retry: USE_DEV_DATA ? false : 1,
            networkMode: 'offlineFirst',
        },
    },
});

interface QueryProviderProps {
    children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
    // Sync react-query's online state with NetInfo (skip in dev mode —
    // DevDataProvider forces offline to prevent Firebase queries)
    useEffect(() => {
        if (USE_DEV_DATA) return;

        const unsubscribe = NetInfo.addEventListener((state) => {
            const isOnline = !!(state.isConnected && state.isInternetReachable !== false);
            onlineManager.setOnline(isOnline);
        });

        return () => unsubscribe();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

// Export queryClient for manual cache manipulation (invalidation, etc.)
export { queryClient };


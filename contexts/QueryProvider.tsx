import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import React, { ReactNode, useEffect } from 'react';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            retry: 2,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: true,
            networkMode: 'offlineFirst',
        },
        mutations: {
            retry: 1,
            networkMode: 'offlineFirst',
        },
    },
});

interface QueryProviderProps {
    children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
    useEffect(() => {
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

export { queryClient };

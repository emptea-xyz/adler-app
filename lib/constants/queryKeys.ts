/**
 * TanStack Query key factory for marketplace data.
 */
export const PROFILE_KEYS = {
    profile: (userId: string) => ['profile', userId] as const,
    walletBalance: (address: string) => ['wallet', 'balance', address] as const,
};

export const PACKAGE_KEYS = {
    list: (filter?: { category?: string; sellerId?: string }) =>
        ['packages', filter ?? {}] as const,
    detail: (packageId: string) => ['package', packageId] as const,
    bySeller: (sellerId: string) => ['packages', 'seller', sellerId] as const,
};

export const GIG_KEYS = {
    list: (filter?: { category?: string; brandId?: string }) =>
        ['gigs', filter ?? {}] as const,
    detail: (gigId: string) => ['gig', gigId] as const,
    byBrand: (brandId: string) => ['gigs', 'brand', brandId] as const,
};

export const APPLICATION_KEYS = {
    forGig: (gigId: string) => ['applications', 'gig', gigId] as const,
    byCreator: (creatorId: string) => ['applications', 'creator', creatorId] as const,
};

export const ORDER_KEYS = {
    asBuyer: (buyerId: string) => ['orders', 'buyer', buyerId] as const,
    asSeller: (sellerId: string) => ['orders', 'seller', sellerId] as const,
    detail: (orderId: string) => ['order', orderId] as const,
};

export const FEED_KEYS = {
    browse: (filter?: { category?: string }) => ['feed', 'browse', filter ?? {}] as const,
};

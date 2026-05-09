import type { ListingCategory, ListingKind } from '@/lib/types/listing';

/**
 * Centralized TanStack Query key factory. Each domain is namespaced under
 * its plural collection root so blanket invalidation works:
 *   `invalidateQueries({ queryKey: qk.orders.all() })`
 * covers every orders-shaped cache entry — single-doc, by-buyer, by-seller.
 *
 * Mirrors the web `lib/constants/queryKeys.ts` factory verbatim so the
 * mental model is portable. The legacy `*_KEYS` exports below are
 * compatibility shims for the existing mobile UI; they will be removed in
 * step 2 once the screens are rewritten to use `qk` directly.
 */
export const qk = {
    profiles: {
        detail: (uid: string) => ['profiles', 'detail', uid] as const,
    },
    listings: {
        list: (kind: ListingKind, category: ListingCategory | null) =>
            ['listings', 'list', kind, category ?? 'all'] as const,
        detail: (kind: ListingKind, id: string) =>
            ['listings', 'detail', kind, id] as const,
        byOwner: (kind: ListingKind, uid: string) =>
            ['listings', 'byOwner', kind, uid] as const,
    },
    applications: {
        byCreator: (uid: string) => ['applications', 'byCreator', uid] as const,
        byBrand: (uid: string) => ['applications', 'byBrand', uid] as const,
    },
    orders: {
        all: () => ['orders'] as const,
        detail: (id: string) => ['orders', 'detail', id] as const,
        bySeller: (uid: string) => ['orders', 'bySeller', uid] as const,
        byBuyer: (uid: string) => ['orders', 'byBuyer', uid] as const,
    },
    threads: {
        byParticipant: (uid: string) => ['threads', 'byParticipant', uid] as const,
        detail: (id: string) => ['threads', 'detail', id] as const,
        messages: (id: string) => ['threads', 'messages', id] as const,
    },
    reviews: {
        byReviewee: (uid: string) => ['reviews', 'byReviewee', uid] as const,
        byListing: (id: string) => ['reviews', 'byListing', id] as const,
        myForOrder: (orderId: string, uid: string) =>
            ['reviews', 'myForOrder', orderId, uid] as const,
    },
    notifications: {
        list: (uid: string) => ['notifications', 'list', uid] as const,
    },
    disputes: {
        detail: (id: string) => ['disputes', 'detail', id] as const,
        byOrder: (orderId: string) => ['disputes', 'byOrder', orderId] as const,
        open: () => ['disputes', 'open'] as const,
        resolved: () => ['disputes', 'resolved'] as const,
        byParticipant: (uid: string) =>
            ['disputes', 'byParticipant', uid] as const,
    },
    roles: {
        detail: (uid: string) => ['roles', 'detail', uid] as const,
    },
    preferences: {
        detail: (uid: string) => ['preferences', 'detail', uid] as const,
    },
    brands: {
        list: (industry: string | null) =>
            ['brands', 'list', industry ?? 'all'] as const,
        byHandle: (handle: string) => ['brands', 'byHandle', handle] as const,
    },
    creators: {
        list: (niche: string | null) =>
            ['creators', 'list', niche ?? 'all'] as const,
        byHandle: (handle: string) => ['creators', 'byHandle', handle] as const,
    },
    wallet: {
        balance: (address: string) => ['wallet', 'balance', address] as const,
        activity: (address: string) => ['wallet', 'activity', address] as const,
        solUsd: () => ['wallet', 'solUsd'] as const,
    },
    escrow: {
        protocolConfig: () => ['escrow', 'protocolConfig'] as const,
        contractEscrow: (orderId: string) =>
            ['escrow', 'contractEscrow', orderId] as const,
    },
} as const;

// ---- Legacy compat shims ----------------------------------------------------
// Kept so the existing UI screens (browse, profile, inbox, etc.) keep
// compiling during step 1. Step 2's UI rewrite migrates everything to `qk`
// and deletes the block below.

export const PROFILE_KEYS = {
    profile: (userId: string) => qk.profiles.detail(userId),
    walletBalance: (address: string) => qk.wallet.balance(address),
};

export const PACKAGE_KEYS = {
    list: (filter?: { category?: string; sellerId?: string }) =>
        ['packages', filter ?? {}] as const,
    detail: (id: string) => qk.listings.detail('service', id),
    bySeller: (sellerId: string) => qk.listings.byOwner('service', sellerId),
};

export const GIG_KEYS = {
    list: (filter?: { category?: string; brandId?: string }) =>
        ['gigs', filter ?? {}] as const,
    detail: (gigId: string) => qk.listings.detail('gig', gigId),
    byBrand: (brandId: string) => qk.listings.byOwner('gig', brandId),
};

export const APPLICATION_KEYS = {
    forGig: (gigId: string) => ['applications', 'gig', gigId] as const,
    byCreator: (creatorId: string) => qk.applications.byCreator(creatorId),
    byBrand: (brandId: string) => qk.applications.byBrand(brandId),
};

export const ORDER_KEYS = {
    asBuyer: (buyerId: string) => qk.orders.byBuyer(buyerId),
    asSeller: (sellerId: string) => qk.orders.bySeller(sellerId),
    detail: (orderId: string) => qk.orders.detail(orderId),
};

export const REVIEW_KEYS = {
    forOrder: (orderId: string) => ['reviews', 'order', orderId] as const,
    byReviewee: (revieweeId: string) => qk.reviews.byReviewee(revieweeId),
};

export const SAVE_KEYS = {
    byUser: (userId: string) => ['saves', 'user', userId] as const,
};

export const FEED_KEYS = {
    browse: (filter?: { category?: string }) => ['feed', 'browse', filter ?? {}] as const,
};

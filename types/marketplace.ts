// Legacy compat layer. Canonical v1 types live under `lib/types/*.ts` —
// this module re-exports them under their old names + a few legacy field
// shims so the step-1 UI keeps compiling. Step 2 rewrites every consumer
// to import from `lib/types/*` directly and this file goes away.

import type { Gig, Service } from '@/lib/types/listing';

export type {
    BrandProfile,
    CreatorProfile,
    DmContact,
    Profile,
    SocialLink,
    SocialPlatform,
    ViewMode,
} from '@/lib/types/profile';

export type {
    Gig,
    GigStatus,
    Listing,
    ListingCategory,
    ListingKind,
    ListingSort,
    Service,
    ServiceStatus,
} from '@/lib/types/listing';

export {
    CATEGORY_LABEL,
    LISTING_CATEGORIES,
    LISTING_SORTS,
    LISTING_SORT_LABEL,
} from '@/lib/types/listing';

export type {
    ApplicationStatus,
    GigApplication,
} from '@/lib/types/application';

export { APPLICATION_STATUS_LABEL } from '@/lib/types/application';

export type {
    Order,
    OrderStatus,
    OrderType,
} from '@/lib/types/order';

export { ORDER_STATUS_LABEL } from '@/lib/types/order';

export type { Review } from '@/lib/types/review';

/**
 * @deprecated Replaced by `isCreator` / `isBrand` denorm booleans on
 * `Profile`. Kept here only so the legacy UI (role-select, RoleSwitchSheet,
 * etc.) still compiles during step 1; step 2 deletes every consumer.
 */
export type UserRole = 'creator' | 'brand';

/**
 * @deprecated Step-1 compat shim. The real v1 type is `Service`
 * (lib/types/listing.ts). The legacy `coverImageUrl` and `deliverables`
 * fields are placeholders so existing UI compiles; both are derived from
 * `mediaUrls` / removed entirely in step 2.
 */
export type PackageListing = Service & {
    coverImageUrl?: string | null;
    deliverables?: string[];
};

/** @deprecated alias of `ServiceStatus`. */
export type PackageStatus = 'active' | 'paused' | 'sold';

// --- Saves -----------------------------------------------------------------
// Saves rule (`saves/{saveId}`) accepts `kind: 'service' | 'gig'`. Doc id
// stays `${userId}_${kind}_${listingId}` to keep tampered writes blocked.

export type SavedKind = 'service' | 'gig';

export interface Save {
    id: string;
    userId: string;
    kind: SavedKind;
    listingId: string;
    createdAt: number;
}

export type FeedItem =
    | { kind: 'service'; data: Service }
    | { kind: 'gig'; data: Gig };

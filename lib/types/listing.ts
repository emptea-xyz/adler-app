// Mirror of adler-website/lib/types/listing.ts. Source of truth for the
// services/{id} and gigs/{id} doc shapes lives in adler-app/firestore.rules.
//
// Field name remap: Firestore docs store sellerHandle/sellerDisplayName/
// sellerAvatarUrl on services and brandHandle/brandDisplayName/
// brandAvatarUrl on gigs. The TS type normalizes both to generic
// ownerHandle/ownerDisplayName/ownerAvatarUrl so the read layer is
// kind-agnostic. listingsService.ts does the mapping.

export const LISTING_CATEGORIES = [
  "beauty",
  "fitness",
  "health",
  "education",
  "food",
  "lifestyle",
  "general",
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export type ListingKind = "service" | "gig";

export type ServiceStatus = "active" | "paused" | "sold";
export type GigStatus = "open" | "awarded" | "closed";

interface ListingBase {
  id: string;
  title: string;
  description: string;
  category: ListingCategory;
  createdAt: number;
  updatedAt: number;
  ownerHandle: string | null;
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  /** Storage download URLs for media (image + short-form video). Cap 5. */
  mediaUrls: string[];
}

export interface Service extends ListingBase {
  kind: "service";
  sellerId: string;
  priceSol: number;
  status: ServiceStatus;
}

export interface Gig extends ListingBase {
  kind: "gig";
  brandId: string;
  budgetSol: number;
  requirements: string;
  status: GigStatus;
}

export type Listing = Service | Gig;

export const CATEGORY_LABEL: Record<ListingCategory, string> = {
  beauty: "Beauty",
  fitness: "Fitness",
  health: "Health",
  education: "Education",
  food: "Food",
  lifestyle: "Lifestyle",
  general: "General",
};

export const LISTING_SORTS = [
  "newest",
  "oldest",
  "price_low",
  "price_high",
] as const;

export type ListingSort = (typeof LISTING_SORTS)[number];

export const LISTING_SORT_LABEL: Record<ListingSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  price_low: "Price: low to high",
  price_high: "Price: high to low",
};

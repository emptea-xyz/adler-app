// Browse-feed filter / sort state. Applied client-side (the feed is small).

export type SortBy = 'date' | 'priceAsc' | 'priceDesc';
export type PriceRange = 'all' | 'under0_1' | '0_1to1' | 'over1';

export interface BrowseFilters {
  sortBy: SortBy;
  category: string | null;
  priceRange: PriceRange;
}

export const DEFAULT_FILTERS: BrowseFilters = {
  sortBy: 'date',
  category: null,
  priceRange: 'all',
};

export const SORT_BY_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'date', label: 'Most recent' },
  { id: 'priceAsc', label: 'Price (low to high)' },
  { id: 'priceDesc', label: 'Price (high to low)' },
];

export const SORT_BY_CHIP_LABEL: Record<SortBy, string> = {
  date: 'Sort by: Date',
  priceAsc: 'Sort by: Price ↑',
  priceDesc: 'Sort by: Price ↓',
};

export const CATEGORY_OPTIONS: { id: string | null; label: string }[] = [
  { id: null, label: 'All categories' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'health', label: 'Health' },
  { id: 'education', label: 'Education' },
  { id: 'food', label: 'Food' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'general', label: 'General' },
];

export const PRICE_RANGE_OPTIONS: { id: PriceRange; label: string; predicate: (sol: number) => boolean }[] = [
  { id: 'all', label: 'Any price', predicate: () => true },
  { id: 'under0_1', label: 'Under 0.1 SOL', predicate: (s) => s < 0.1 },
  { id: '0_1to1', label: '0.1 – 1 SOL', predicate: (s) => s >= 0.1 && s <= 1 },
  { id: 'over1', label: 'Over 1 SOL', predicate: (s) => s > 1 },
];

export const PRICE_RANGE_CHIP_LABEL: Record<PriceRange, string> = {
  all: 'Price range',
  under0_1: 'Under 0.1 SOL',
  '0_1to1': '0.1 – 1 SOL',
  over1: 'Over 1 SOL',
};

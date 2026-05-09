/**
 * Port of adler-website/lib/utils/industries.ts. Stored values must stay
 * stable because brand profile docs persist these strings verbatim.
 */
export type IndustryAccent = 'pink' | 'orange' | 'lime' | 'cyan';

export interface IndustryGroup {
    label: string;
    color: IndustryAccent;
    options: readonly string[];
}

export const INDUSTRY_GROUPS: readonly IndustryGroup[] = [
    {
        label: 'Beauty & Fashion',
        color: 'pink',
        options: [
            'Beauty & Cosmetics',
            'Skincare',
            'Haircare',
            'Fragrance',
            'Fashion & Apparel',
            'Luxury Fashion',
            'Streetwear',
            'Footwear',
            'Jewelry & Accessories',
            'Eyewear',
        ],
    },
    {
        label: 'Food & Drink',
        color: 'orange',
        options: [
            'Food & Restaurant',
            'Snacks & Confectionery',
            'Beverages',
            'Coffee & Tea',
            'Alcohol & Spirits',
            'Meal Kits & Delivery',
            'Supplements & Nutrition',
            'Cooking & Kitchenware',
        ],
    },
    {
        label: 'Health & Wellness',
        color: 'lime',
        options: [
            'Fitness & Sports',
            'Athleisure',
            'Yoga & Mindfulness',
            'Mental Health',
            'Healthcare & Medical',
            'Pharmacy',
        ],
    },
    {
        label: 'Tech & Software',
        color: 'cyan',
        options: [
            'Consumer Electronics',
            'Software & SaaS',
            'Mobile Apps',
            'AI & ML Tools',
            'Cybersecurity',
            'Smart Home & IoT',
            'Wearables',
        ],
    },
    {
        label: 'Finance & Crypto',
        color: 'lime',
        options: [
            'Banking & Fintech',
            'Investing & Trading',
            'Cryptocurrency',
            'Insurance',
            'Personal Finance',
            'Real Estate',
        ],
    },
    {
        label: 'Entertainment & Media',
        color: 'pink',
        options: [
            'Music & Streaming',
            'Film & TV',
            'Gaming & Esports',
            'Books & Publishing',
            'Podcasts',
            'News & Magazines',
        ],
    },
    {
        label: 'Travel & Hospitality',
        color: 'cyan',
        options: [
            'Travel & Tourism',
            'Airlines',
            'Hotels & Resorts',
            'Vacation Rentals',
            'Travel Gear',
        ],
    },
    {
        label: 'Home & Lifestyle',
        color: 'orange',
        options: [
            'Home & Garden',
            'Furniture & Decor',
            'Cleaning & Household',
            'Pets & Pet Care',
            'Parenting & Baby',
            'Toys & Games',
        ],
    },
    {
        label: 'Auto & Mobility',
        color: 'cyan',
        options: ['Automotive', 'EVs & Mobility', 'Motorcycles & Bikes'],
    },
    {
        label: 'Education & Career',
        color: 'cyan',
        options: [
            'Education & EdTech',
            'Online Courses',
            'Professional Coaching',
            'Career & Recruitment',
        ],
    },
    {
        label: 'Retail & Marketplaces',
        color: 'orange',
        options: ['E-commerce & Marketplaces', 'Subscription Boxes'],
    },
    {
        label: 'Arts & Crafts',
        color: 'pink',
        options: [
            'Arts & Crafts',
            'Photography & Cameras',
            'DIY & Maker',
            'Stationery',
        ],
    },
    {
        label: 'Cannabis & Adult',
        color: 'pink',
        options: ['Cannabis & CBD', 'Vape & Smoking', 'Adult & 18+'],
    },
    {
        label: 'Causes & Sustainability',
        color: 'lime',
        options: [
            'Sustainability & Eco',
            'Nonprofit & Charity',
            'Politics & Advocacy',
        ],
    },
    {
        label: 'Professional Services',
        color: 'cyan',
        options: [
            'Marketing & Advertising',
            'Consulting',
            'Legal Services',
            'Accounting',
        ],
    },
] as const;

export const INDUSTRY_OPTIONS: readonly string[] = INDUSTRY_GROUPS.flatMap(
    (group) => group.options,
);

export function isValidIndustry(value: string | null): boolean {
    return value === null || INDUSTRY_OPTIONS.includes(value);
}

export type UserRole = 'creator' | 'brand';

export interface Profile {
    id: string;
    role: UserRole | null;
    username: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    walletAddress: string | null;
    createdAt: number;
    updatedAt: number;
}

export type PackageStatus = 'active' | 'paused' | 'sold';

export interface PackageListing {
    id: string;
    sellerId: string;
    title: string;
    description: string;
    priceSol: number;
    deliverables: string[];
    mediaUrls: string[];
    category: string;
    status: PackageStatus;
    createdAt: number;
}

export type GigStatus = 'open' | 'awarded' | 'closed';

export interface Gig {
    id: string;
    brandId: string;
    title: string;
    description: string;
    budgetSol: number;
    deadline: number | null;
    requirements: string;
    category: string;
    status: GigStatus;
    createdAt: number;
}

export type ApplicationStatus = 'pending' | 'shortlisted' | 'awarded' | 'rejected';

export interface GigApplication {
    id: string;
    gigId: string;
    creatorId: string;
    message: string;
    sampleUrls: string[];
    status: ApplicationStatus;
    createdAt: number;
}

export type OrderType = 'package' | 'gig';
export type OrderStatus = 'pending' | 'paid' | 'delivered' | 'complete';

export interface Order {
    id: string;
    type: OrderType;
    referenceId: string;
    buyerId: string;
    sellerId: string;
    amountSol: number;
    txSignature: string | null;
    status: OrderStatus;
    createdAt: number;
    updatedAt: number;
}

export interface Review {
    id: string;
    orderId: string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    comment: string;
    createdAt: number;
}

export type FeedItem =
    | { kind: 'package'; data: PackageListing }
    | { kind: 'gig'; data: Gig };

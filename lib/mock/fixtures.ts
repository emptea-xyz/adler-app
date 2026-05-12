import type { Bounty } from '@/lib/types/bounty';
import type { Submission } from '@/lib/types/submission';
import type { Profile } from '@/lib/types/profile';
import type { AdlerNotification } from '@/lib/types/notification';
import type { Group, GroupMember } from '@/lib/types/group';
import { DEFAULT_LOCATION } from '@/lib/types/profile';
import { DEMO_USER_ID, DEMO_WALLET_ADDRESS } from './index';

const NOW = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const SUBMISSION_WINDOW = 30 * DAY;
const REVIEW_WINDOW = 90 * DAY;
const SOL = 1_000_000_000;

const wallet = (tag: string) =>
    `${tag.slice(0, 8).padEnd(8, '1')}MockWalletAddress11111111111111111`.slice(0, 44);

// ─── Profiles ────────────────────────────────────────────────────────────

export const DEMO_PROFILE: Profile = {
    id: DEMO_USER_ID,
    username: 'maru',
    displayName: 'Maru',
    bio: 'Founder · Adler',
    avatarUrl: null,
    walletAddress: DEMO_WALLET_ADDRESS,
    location: { kind: 'country', country: 'CH' },
    groupCount: 2,
    lamportsWonFromBounties: Math.round(3.2 * SOL),
    bountiesWon: 4,
    bountiesParticipated: 7,
    latestActivityAt: NOW - 2 * HOUR,
    createdAt: NOW - 42 * DAY,
    updatedAt: NOW - 2 * HOUR,
    lastUsernameChangeAt: 0,
};

function p(
    id: string,
    username: string,
    displayName: string,
    bio: string,
    won: number,
    wonLamports: number,
    participated: number,
    createdDaysAgo: number,
): Profile {
    return {
        id,
        username,
        displayName,
        bio,
        avatarUrl: null,
        walletAddress: wallet(id),
        location: DEFAULT_LOCATION,
        groupCount: 0,
        lamportsWonFromBounties: wonLamports,
        bountiesWon: won,
        bountiesParticipated: participated,
        latestActivityAt: NOW - createdDaysAgo * DAY,
        createdAt: NOW - (createdDaysAgo + 30) * DAY,
        updatedAt: NOW - createdDaysAgo * DAY,
        lastUsernameChangeAt: 0,
    };
}

const OTHER_PROFILES: Profile[] = [
    p('user_nikolai', 'nikolai', 'Nikolai Vaerum', 'Industrial photographer', 9, Math.round(12.4 * SOL), 14, 1),
    p('user_iris', 'irismakes', 'Iris Tanaka', 'Brand systems designer', 7, Math.round(9.8 * SOL), 11, 3),
    p('user_lev', 'lev_b', 'Lev Bronshtein', 'Motion · Founder @ Foundry', 6, Math.round(7.1 * SOL), 9, 2),
    p('user_kai', 'kaifrost', 'Kai Frost', 'Solana DePIN · ex-Helium', 5, Math.round(6.0 * SOL), 8, 4),
    p('user_marco', 'marcoruiz', 'Marco Ruiz', 'Product copy & narrative', 5, Math.round(4.5 * SOL), 9, 5),
    p('user_zara', 'zara', 'Zara Okafor', 'iOS engineer', 3, Math.round(3.8 * SOL), 6, 6),
    p('user_eli', 'eli', 'Eli Reisinger', 'Pitch deck operator', 3, Math.round(2.5 * SOL), 5, 7),
    p('user_yuki', 'yuki', 'Yuki Tanaka', 'Editorial photography', 2, Math.round(1.9 * SOL), 4, 8),
    p('user_omar', 'omar', 'Omar Haddad', 'Marketing video · Beirut', 2, Math.round(1.5 * SOL), 4, 9),
    p('user_anya', 'anya', 'Anya Volkov', '3D, generative, ambient', 1, Math.round(0.9 * SOL), 3, 10),
];

export const MOCK_PROFILES: Record<string, Profile> = {
    [DEMO_PROFILE.id]: DEMO_PROFILE,
    ...Object.fromEntries(OTHER_PROFILES.map((u) => [u.id, u])),
};

export const LEADERBOARD_PROFILES: Profile[] = [DEMO_PROFILE, ...OTHER_PROFILES];

// ─── Groups ──────────────────────────────────────────────────────────────

export const MOCK_GROUPS: Group[] = [
    {
        id: 'group_adler_internal',
        name: 'Adler Internal',
        description: 'Bounties for the Adler core team and trusted contributors.',
        ownerId: DEMO_USER_ID,
        createdAt: NOW - 38 * DAY,
        status: 'active',
        memberCount: 12,
        openBountyTotalLamports: Math.round(4.25 * SOL),
        logoUrl: null,
    },
    {
        id: 'group_solana_builders',
        name: 'Solana Builders',
        description: 'Cross-team bounty board for Solana ecosystem teams.',
        ownerId: 'user_kai',
        createdAt: NOW - 60 * DAY,
        status: 'active',
        memberCount: 47,
        openBountyTotalLamports: Math.round(11.2 * SOL),
        logoUrl: null,
    },
    {
        id: 'group_crypto_designers',
        name: 'Crypto Designers',
        description: 'Designers working at the intersection of crypto and consumer.',
        ownerId: 'user_iris',
        createdAt: NOW - 75 * DAY,
        status: 'active',
        memberCount: 23,
        openBountyTotalLamports: Math.round(2.6 * SOL),
        logoUrl: null,
    },
];

const MEMBERSHIPS: GroupMember[] = [
    {
        id: `group_adler_internal_${DEMO_USER_ID}`,
        groupId: 'group_adler_internal',
        uid: DEMO_USER_ID,
        joinedAt: NOW - 38 * DAY,
        role: 'admin',
    },
    {
        id: `group_solana_builders_${DEMO_USER_ID}`,
        groupId: 'group_solana_builders',
        uid: DEMO_USER_ID,
        joinedAt: NOW - 25 * DAY,
        role: 'member',
    },
];

export function getMyMemberships(uid: string): GroupMember[] {
    if (uid !== DEMO_USER_ID) return [];
    return MEMBERSHIPS;
}

export function getGroupMembers(groupId: string): GroupMember[] {
    const group = MOCK_GROUPS.find((g) => g.id === groupId);
    if (!group) return [];
    // Synthesize members for a believable list.
    const others = OTHER_PROFILES.slice(0, Math.min(group.memberCount - 1, 8));
    const list: GroupMember[] = [
        {
            id: `${groupId}_${group.ownerId}`,
            groupId,
            uid: group.ownerId,
            joinedAt: group.createdAt,
            role: 'admin',
        },
    ];
    others.forEach((profile, i) => {
        if (profile.id === group.ownerId) return;
        list.push({
            id: `${groupId}_${profile.id}`,
            groupId,
            uid: profile.id,
            joinedAt: group.createdAt + (i + 1) * DAY,
            role: 'member',
        });
    });
    return list;
}

// ─── Bounties ────────────────────────────────────────────────────────────

function bounty(
    id: string,
    posterId: string,
    title: string,
    prompt: string,
    sol: number,
    kind: Bounty['submissionKind'],
    status: Bounty['status'],
    createdDaysAgo: number,
    opts: { scope?: Bounty['scope']; groupId?: string | null; submissionCount?: number; winnerId?: string | null; winningSubmissionId?: string | null } = {},
): Bounty {
    const createdAt = NOW - createdDaysAgo * DAY;
    const submissionEndsAt = createdAt + SUBMISSION_WINDOW;
    const expiresAt = submissionEndsAt + REVIEW_WINDOW;
    const poster = MOCK_PROFILES[posterId];
    return {
        id,
        posterId,
        posterWalletAddress: poster?.walletAddress ?? wallet(posterId),
        title,
        prompt,
        bountyLamports: Math.round(sol * SOL),
        createdAt,
        submissionEndsAt,
        expiresAt,
        status,
        scope: opts.scope ?? 'public',
        groupId: opts.groupId ?? null,
        winnerId: opts.winnerId ?? null,
        winningSubmissionId: opts.winningSubmissionId ?? null,
        txSignature:
            status === 'settled' || status === 'refunded'
                ? '5x3Demo' + id.replace(/[^a-zA-Z0-9]/g, '') + 'Tx1111111111111111111111111111111'
                : null,
        reportCount: 0,
        contractIdHex: id.padEnd(64, '0').slice(0, 64),
        escrowFunded: true,
        submissionCount: opts.submissionCount ?? 0,
        submissionKind: kind,
    };
}

export const MOCK_BOUNTIES: Bounty[] = [
    // Public · open
    bounty(
        'bnt_sunrise',
        'user_nikolai',
        'Sunrise photo over a mountain ridge — landscape, no people',
        'Shoot at golden hour. Landscape orientation. No people, no signs. Native-resolution JPEG. Looking for a single hero shot, not a series.',
        0.5,
        'photo',
        'open',
        2,
        { submissionCount: 8 },
    ),
    bounty(
        'bnt_logo',
        'user_iris',
        'Wordmark + favicon for a SaaS analytics startup',
        'Brand name is "Pinecone". Modern, geometric, friendly. Deliver SVG + favicon ICO. Link to a Figma file or zip with the assets.',
        2.0,
        'link',
        'open',
        1,
        { submissionCount: 4 },
    ),
    bounty(
        'bnt_demo_video',
        'user_lev',
        '30-second product demo video for a new productivity app',
        'Show 3 core flows in 30s. 1080p portrait. Voiceover optional. Tone: precise, fast, unironic.',
        1.5,
        'video',
        'open',
        3,
        { submissionCount: 2 },
    ),
    bounty(
        'bnt_essay',
        'user_marco',
        'Short essay (~600 words) on why Web3 UX still feels off',
        'Original writing. No AI fluff. Argue a specific position. Submit as a Gist or Notion link.',
        0.25,
        'link',
        'open',
        4,
        { submissionCount: 11 },
    ),
    bounty(
        'bnt_icon',
        'user_zara',
        'iOS app icon — 1024×1024 PNG',
        'Brand is industrial, monochrome, geometric. No gradients, no skeuomorphism. PNG only.',
        1.0,
        'photo',
        'open',
        5,
        { submissionCount: 6 },
    ),
    bounty(
        'bnt_product_photo',
        'user_yuki',
        'Industrial product photography — metal hardware on white seamless',
        '3 angles. Each at least 4000px on the long edge. Hard lighting, no diffusion. JPEG.',
        0.8,
        'photo',
        'open',
        6,
        { submissionCount: 3 },
    ),
    bounty(
        'bnt_cta',
        'user_marco',
        '5 CTA button copy options for a B2B onboarding flow',
        'Each ≤3 words. State exactly what happens on tap. Link to a Doc / Gist with the variations.',
        0.1,
        'link',
        'open',
        7,
        { submissionCount: 14 },
    ),
    bounty(
        'bnt_moodboard',
        DEMO_USER_ID,
        'Mood board for Adler v2 — industrial precision, cockpit aesthetic',
        'Pinterest or Figma link. Aim for clarity over decoration. Stripe Dashboard meets a gauge cluster.',
        0.75,
        'link',
        'open',
        2,
        { submissionCount: 5 },
    ),

    // Public · in_review
    bounty(
        'bnt_thread',
        'user_kai',
        'Twitter thread (8–12 tweets) on Solana DePIN, beginner-friendly',
        'Hook, 3 examples, why now. Plain language. Submit as link to a draft thread or Notion.',
        0.75,
        'link',
        'in_review',
        32,
        { submissionCount: 19 },
    ),
    bounty(
        'bnt_pitch_deck',
        'user_eli',
        'Pitch deck for an AI-x-edu startup — 12 slides max',
        'Series A flavor. Bring real design. Submit as Google Slides / Figma link.',
        5.0,
        'link',
        'in_review',
        35,
        { submissionCount: 22 },
    ),

    // Settled — demo user won this one
    bounty(
        'bnt_fintech_video',
        'user_omar',
        '15-second marketing video for a fintech product',
        'Portrait 1080p. Punchy first frame. Voiceover OK.',
        3.0,
        'video',
        'settled',
        130,
        {
            submissionCount: 18,
            winnerId: DEMO_USER_ID,
            winningSubmissionId: `bnt_fintech_video_${DEMO_USER_ID}`,
        },
    ),

    // Group · open (Solana Builders) — not posted by demo user
    bounty(
        'bnt_grp_dashboard',
        'user_kai',
        'Dashboard concept for a Solana validator console',
        'Members-only bounty. Frame 1 hero screen. Figma link.',
        2.5,
        'link',
        'open',
        2,
        {
            scope: 'group',
            groupId: 'group_solana_builders',
            submissionCount: 1,
        },
    ),
    bounty(
        'bnt_grp_internal_brief',
        DEMO_USER_ID,
        'Adler launch teaser — single-frame Instagram still',
        'For the internal launch run-up. 1080×1350. Industrial, restrained, no copy.',
        1.5,
        'photo',
        'open',
        1,
        {
            scope: 'group',
            groupId: 'group_adler_internal',
            submissionCount: 0,
        },
    ),
];

export function getBountyById(id: string): Bounty | null {
    return MOCK_BOUNTIES.find((b) => b.id === id) ?? null;
}

export function getOpenPublicBounties(): Bounty[] {
    return MOCK_BOUNTIES.filter((b) => b.scope === 'public' && b.status === 'open');
}

export function getOpenGroupBounties(groupIds: string[]): Bounty[] {
    if (groupIds.length === 0) return [];
    const set = new Set(groupIds);
    return MOCK_BOUNTIES.filter(
        (b) => b.scope === 'group' && b.status === 'open' && b.groupId && set.has(b.groupId),
    );
}

export function getMyPostedBounties(uid: string): Bounty[] {
    return MOCK_BOUNTIES.filter((b) => b.posterId === uid).sort(
        (a, b) => b.createdAt - a.createdAt,
    );
}

// ─── Submissions ─────────────────────────────────────────────────────────

function sub(
    bountyId: string,
    submitterId: string,
    submittedDaysAgo: number,
    overrides: Partial<Submission> = {},
): Submission {
    const b = MOCK_BOUNTIES.find((x) => x.id === bountyId);
    if (!b) throw new Error(`Bounty ${bountyId} not found for submission fixture`);
    return {
        id: `${bountyId}_${submitterId}`,
        bountyId,
        submitterId,
        photoUrl: '',
        photoStoragePath: '',
        videoUrl: '',
        videoStoragePath: '',
        linkUrl: b.submissionKind === 'link' ? 'https://example.com/demo-submission' : null,
        submittedAt: NOW - submittedDaysAgo * DAY,
        isWinner: overrides.isWinner ?? false,
        bountyTitle: b.title,
        bountyLamports: b.bountyLamports,
        bountyStatus: b.status,
        bountyPosterId: b.posterId,
        bountySubmissionKind: b.submissionKind,
        bountyScope: b.scope,
        bountyGroupId: b.groupId,
        ...overrides,
    };
}

export const MOCK_SUBMISSIONS: Submission[] = [
    sub('bnt_fintech_video', DEMO_USER_ID, 132, { isWinner: true }),
    sub('bnt_sunrise', DEMO_USER_ID, 1),
    sub('bnt_icon', DEMO_USER_ID, 3),
    sub('bnt_cta', DEMO_USER_ID, 4),
    sub('bnt_thread', DEMO_USER_ID, 25),
    // Submissions from others on demo user's open bounty so the inbox
    // "Posted" view feels alive.
    sub('bnt_moodboard', 'user_iris', 1),
    sub('bnt_moodboard', 'user_lev', 1),
    sub('bnt_moodboard', 'user_anya', 2),
    sub('bnt_moodboard', 'user_yuki', 2),
];

export function getSubmissionsForBounty(bountyId: string): Submission[] {
    return MOCK_SUBMISSIONS.filter((s) => s.bountyId === bountyId).sort(
        (a, b) => a.submittedAt - b.submittedAt,
    );
}

export function getMySubmissions(uid: string): Submission[] {
    return MOCK_SUBMISSIONS.filter((s) => s.submitterId === uid).sort(
        (a, b) => b.submittedAt - a.submittedAt,
    );
}

// ─── Notifications ───────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: AdlerNotification[] = [
    {
        id: 'ntf_won',
        recipientId: DEMO_USER_ID,
        kind: 'bounty_won',
        title: 'You won a bounty',
        body: 'Your video for "15-second marketing video for a fintech product" was picked. 3 SOL just landed.',
        href: '/bounty/bnt_fintech_video',
        read: false,
        refs: { bountyId: 'bnt_fintech_video' },
        createdAt: NOW - 2 * HOUR,
    },
    {
        id: 'ntf_submission',
        recipientId: DEMO_USER_ID,
        kind: 'bounty_submission_received',
        title: 'New submission',
        body: '@irismakes submitted to "Mood board for Adler v2 — industrial precision, cockpit aesthetic".',
        href: '/bounty/bnt_moodboard',
        read: false,
        refs: { bountyId: 'bnt_moodboard' },
        createdAt: NOW - 6 * HOUR,
    },
    {
        id: 'ntf_submission_2',
        recipientId: DEMO_USER_ID,
        kind: 'bounty_submission_received',
        title: 'New submission',
        body: '@lev_b submitted to "Mood board for Adler v2".',
        href: '/bounty/bnt_moodboard',
        read: true,
        refs: { bountyId: 'bnt_moodboard' },
        createdAt: NOW - 1 * DAY,
    },
    {
        id: 'ntf_group_approved',
        recipientId: DEMO_USER_ID,
        kind: 'group_join_approved',
        title: 'You joined Solana Builders',
        body: 'Group bounties from this team will show up in Browse → My Groups.',
        href: '/(home)/(tabs)/browse',
        read: true,
        refs: { groupId: 'group_solana_builders' },
        createdAt: NOW - 25 * DAY,
    },
    {
        id: 'ntf_system',
        recipientId: DEMO_USER_ID,
        kind: 'system',
        title: 'Welcome to Adler',
        body: 'Funded bounties, manual settlement, on-chain escrow. Post your first one any time.',
        href: '/(home)/(tabs)/browse',
        read: true,
        refs: {},
        createdAt: NOW - 42 * DAY,
    },
];

export function getMyNotifications(uid: string): AdlerNotification[] {
    if (uid !== DEMO_USER_ID) return [];
    return MOCK_NOTIFICATIONS;
}

// ─── Wallet activity ─────────────────────────────────────────────────────

export interface DemoActivityItem {
    signature: string;
    blockTimeMs: number | null;
    success: boolean;
}

export const MOCK_WALLET_ACTIVITY: DemoActivityItem[] = [
    {
        signature: '5x3DemoFintechVidWin1111111111111111111111111111111111111111111111111111111111',
        blockTimeMs: NOW - 2 * HOUR,
        success: true,
    },
    {
        signature: '4q9DemoMoodboardEscrowFundTx2222222222222222222222222222222222222222222222222',
        blockTimeMs: NOW - 2 * DAY,
        success: true,
    },
    {
        signature: '3p7DemoIconSubmitTx33333333333333333333333333333333333333333333333333333333333',
        blockTimeMs: NOW - 3 * DAY,
        success: true,
    },
    {
        signature: '2n5DemoCtaSubmitTx4444444444444444444444444444444444444444444444444444444444444',
        blockTimeMs: NOW - 4 * DAY,
        success: true,
    },
    {
        signature: '1m1DemoOnboardingDepositTx55555555555555555555555555555555555555555555555555555',
        blockTimeMs: NOW - 14 * DAY,
        success: true,
    },
];

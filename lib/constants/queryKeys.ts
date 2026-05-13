/**
 * Centralized TanStack Query key factory. Each domain is namespaced under
 * its plural collection root so blanket invalidation works:
 *   `invalidateQueries({ queryKey: qk.bounties.all() })`
 * covers every bounties-shaped cache entry.
 */
import type { BountyStatus } from '@/lib/types/bounty';

export const qk = {
  profiles: {
    detail: (uid: string) => ['profiles', 'detail', uid] as const,
    search: (q: string) => ['profiles', 'search', q] as const,
  },
  bounties: {
    all: () => ['bounties'] as const,
    detail: (id: string) => ['bounties', 'detail', id] as const,
    listPublic: (status: BountyStatus = 'open') =>
      ['bounties', 'list', 'public', status] as const,
    listGroup: (groupIds: string[], status: BountyStatus = 'open') =>
      ['bounties', 'list', 'group', [...groupIds].sort(), status] as const,
    byPoster: (uid: string) => ['bounties', 'byPoster', uid] as const,
  },
  submissions: {
    all: () => ['submissions'] as const,
    byBounty: (bountyId: string) =>
      ['submissions', 'byBounty', bountyId] as const,
    bySubmitter: (uid: string) =>
      ['submissions', 'bySubmitter', uid] as const,
    mineForBounty: (bountyId: string, uid: string) =>
      ['submissions', 'mineForBounty', bountyId, uid] as const,
  },
  groups: {
    all: () => ['groups'] as const,
    detail: (id: string) => ['groups', 'detail', id] as const,
    myMemberships: (uid: string) => ['groups', 'myMemberships', uid] as const,
    members: (groupId: string) => ['groups', 'members', groupId] as const,
    list: () => ['groups', 'list'] as const,
    search: (q: string) => ['groups', 'search', q] as const,
    joinRequests: (groupId: string) =>
      ['groups', 'joinRequests', groupId] as const,
    myJoinRequest: (groupId: string, uid: string) =>
      ['groups', 'myJoinRequest', groupId, uid] as const,
  },
  notifications: {
    list: (uid: string) => ['notifications', 'list', uid] as const,
  },
  preferences: {
    detail: (uid: string) => ['preferences', 'detail', uid] as const,
  },
  wallet: {
    balance: (address: string | null) =>
      ['wallet', 'balance', address ?? 'none'] as const,
    activity: (address: string | null) =>
      ['wallet', 'activity', address ?? 'none'] as const,
  },
};

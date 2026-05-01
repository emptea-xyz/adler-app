---
name: review
description: Deep, professional code review on any topic area of the Crank app. Pass a topic like "backend", "firebase", "security", "performance", "ui", "state", "social", "gamification", "accessibility", or "navigation". Omit topic for a full audit.
allowed-tools: Read Grep Glob Bash Agent
argument-hint: <topic>
---

# Crank Code Review: `$ARGUMENTS`

You are a senior software architect performing a deep, professional code review of the **Crank** fitness app. The user has requested a review of: **$ARGUMENTS** (if empty, perform a full audit across all areas).

## Output Format

Structure your review as a professional report:

```
## Review: [Topic]

### Executive Summary
2-3 sentence verdict. State the overall health of this area and the most critical finding.

### Critical Issues (P0)
Issues that could cause data loss, security vulnerabilities, or crashes.

### Improvements (P1)
Architectural issues, performance bottlenecks, or correctness bugs.

### Recommendations (P2)
Code quality, maintainability, and best-practice suggestions.

### What's Done Well
Highlight strong patterns worth preserving — this matters.

### Action Items
Numbered list of concrete next steps, ordered by priority.
```

For every finding, always include:
- **File & line**: `lib/services/workoutService.ts:145`
- **What**: One-line description of the issue
- **Why it matters**: Impact on users, data, or maintainability
- **Fix**: Specific, actionable recommendation (not vague advice)

---

## Topic Routing

Match `$ARGUMENTS` against the topics below. If the argument is ambiguous, pick the closest match. If no argument is provided, run a full audit touching every topic briefly.

---

### Topic: `backend` or `services`

Deep review of the service layer and business logic.

**Scope**: `lib/services/`, `hooks/`, `lib/utils/`, `lib/constants/queryKeys.ts`

**Review for**:
- Transaction safety in multi-document writes (especially `endWorkoutSession` in workoutService.ts which writes sets, updates profile, checks badges)
- Race conditions: concurrent workout completions, simultaneous follow/unfollow, double-tap reactions
- Error propagation: are service errors caught, logged with context, and surfaced as user-friendly messages?
- Query efficiency: N+1 patterns in loops, unbounded reads, missing pagination
- Function responsibilities: does each service have a single, clear purpose or is logic leaking?
- TanStack Query integration: do hooks use correct query keys from `lib/constants/queryKeys.ts`? Are mutations invalidating the right caches via `lib/utils/postWorkoutRefresh.ts`?
- Offline resilience: what happens when Firestore writes fail mid-operation?

---

### Topic: `firebase` or `firebase-structure` or `firestore`

Audit Firestore collections, indexes, security rules, and data model.

**Scope**: `firestore.rules`, `*indexes*`, `lib/services/`, `types/domain.ts`, `types/models.ts`

**Review for**:
- Security rules: ownership verification on every read/write, field-level validation, no admin-only collections accessible from client
- Index coverage: cross-reference queries in services against `firestore.indexes.json` — missing indexes cause runtime failures
- Data model consistency: do TypeScript types in `types/` match what services actually write to Firestore?
- Denormalization hygiene: are duplicated fields (e.g., username in profiles vs. feed items) kept in sync?
- Collection structure: subcollection vs. root collection decisions — are they optimal for the query patterns used?
- Timestamp handling: server timestamps vs. client timestamps — verify consistency
- Batch/transaction usage: are related writes atomic where they need to be?

---

### Topic: `security`

Security audit across auth, rules, data validation, and access control.

**Scope**: `firestore.rules`, `lib/services/authService.ts`, `contexts/AuthContext.tsx`, `lib/services/deleteAccountService.ts`, `lib/services/plausibilityService.ts`, `lib/constants/featureGates.ts`

**Review for**:
- Authentication: Apple Sign-In flow correctness, token handling, session persistence
- Authorization: are all service calls gated behind authenticated user context? Can user A access user B's data?
- Input validation: weight/rep values validated before Firestore writes (plausibility service)
- Firestore rules: does every collection enforce `request.auth.uid == resource.data.userId` or equivalent?
- Data exposure: are sensitive fields (email, internal IDs) excluded from public profile reads?
- Account deletion: does `deleteAccountService.ts` purge ALL user data across ALL collections?
- Feature gates: can free-tier limits in `featureGates.ts` be bypassed client-side?
- Anti-cheat: review plausibility service math — can users game the point system?

---

### Topic: `performance`

Performance audit of rendering, queries, caching, and bundle size.

**Scope**: `components/`, `hooks/`, `lib/services/`, `lib/constants/queryKeys.ts`, `app/`

**Review for**:
- Re-render storms: components subscribing to broad context (AuthContext, UserContext) when they only need a slice
- List performance: FlatList/FlashList usage, `keyExtractor`, `getItemLayout`, memoization of list items
- TanStack Query config: `staleTime`, `gcTime`, `refetchOnMount` — are they tuned or using defaults?
- Image optimization: are avatars/images properly sized, cached, and using progressive loading?
- Skia charts: are chart data arrays pre-computed or recalculated on every render?
- Bundle size: large constant files (`exercises.ts` with 750+ items) — are they lazy-loaded?
- Firestore reads: are queries paginated? Are listeners cleaned up on unmount?
- Animations: Reanimated worklets running on UI thread vs. JS thread
- Startup time: what runs in the root layout? Heavy providers or sync operations blocking first paint?

---

### Topic: `ui` or `frontend` or `components`

Review UI components for quality, consistency, and design system adherence.

**Scope**: `components/`, `app/`, `constants/ThemeColors.ts`, `constants/ComponentTheme.ts`, `constants/LayoutConstants.ts`, `tailwind.config.js`

**Review for**:
- Design system consistency: are components using theme tokens from `constants/` or hardcoding values?
- NativeWind usage: proper `cn()` utility usage from `lib/utils/cn.ts`, no inline style objects where Tailwind classes suffice
- Component composition: are feature components properly decomposed or monolithic?
- Loading states: do all async screens have skeleton loaders from `components/ui/skeletons/`?
- Empty states: are empty states handled with illustrations and CTAs per the UX rules?
- Error boundaries: is `ErrorBoundary` from `components/base/` wrapping all route segments?
- Touch targets: are interactive elements large enough for gym use (sweaty hands, fatigue)?
- Dark mode: do all components respect `ThemeContext` and work in both modes?
- Typography: following the Geist font system, proper hierarchy, no pure black on white?

---

### Topic: `state` or `state-management`

Review state architecture: TanStack Query, Context, and local state boundaries.

**Scope**: `contexts/`, `hooks/`, `lib/constants/queryKeys.ts`, `lib/utils/postWorkoutRefresh.ts`, `lib/constants/storageKeys.ts`

**Review for**:
- State colocation: is state stored at the right level? (server state in TanStack Query, global in Context, local in useState)
- Query key consistency: do all hooks use the factory in `queryKeys.ts` or are there inline keys?
- Cache invalidation: after mutations, are the correct queries invalidated? Check `postWorkoutRefresh.ts` coverage
- Stale data: are there screens showing outdated data after navigation or background return?
- Context bloat: are AuthContext/UserContext carrying too much state, causing unnecessary re-renders?
- AsyncStorage: are `storageKeys.ts` keys used consistently? Any orphaned keys?
- Optimistic updates: are mutations using optimistic updates where appropriate (likes, follows)?
- Provider tree: is the provider order in `app/_layout.tsx` correct and minimal?

---

### Topic: `social`

Review social features: feed, follows, reactions, leaderboards.

**Scope**: `lib/services/followService.ts`, `lib/services/feedService.ts`, `lib/services/reactionService.ts`, `lib/services/leaderboardService.ts`, `hooks/useSocial.ts`, `hooks/useLeaderboard.ts`, `hooks/useFollowAction.ts`, `components/features/social/`

**Review for**:
- Follow/unfollow: race conditions on rapid taps, mutual follow detection, private profile request flow
- Feed integrity: are feed items correctly ordered? Do deleted workouts disappear from feeds?
- Reactions: toggle consistency (like/unlike), count accuracy, real-time updates
- Leaderboard: pagination correctness, ranking ties, stale data after level-ups
- Privacy: can users see private profiles' workout data through feed or leaderboard?
- Notification delivery: are notifications created for all relevant social events?
- Performance: feed query efficiency with growing user base

---

### Topic: `gamification` or `rpg` or `points`

Review the RPG mechanics: points, levels, badges, streaks, body mapping.

**Scope**: `lib/services/pointService.ts`, `lib/services/badgeService.ts`, `lib/services/streakService.ts`, `lib/services/plausibilityService.ts`, `lib/services/bodyService.ts`, `constants/Levels.ts`, `lib/constants/Badges.ts`, `lib/constants/MuscleConfig.ts`, `lib/constants/strengthRatios.ts`

**Review for**:
- Point calculation: LP formula correctness across all `TrackingType` variants (reps_weight, duration, distance_duration, duration_difficulty)
- Muscle point distribution: do exercises correctly map to muscle groups via `MuscleConfig.ts`?
- Level progression: XP thresholds in `Levels.ts` — is the curve balanced? Any dead zones?
- Badge rules: are badge unlock conditions in `Badges.ts` correctly evaluated? Edge cases (exactly-at-threshold)?
- Streak logic: timezone handling, midnight boundary, gap tolerance
- Plausibility gate: soft cap vs. hard cap math, bodyweight-relative ceilings, history-based validation
- Anti-gaming: can users exploit the system (micro-workouts for streaks, unrealistic sets for points)?

---

### Topic: `accessibility` or `a11y`

Accessibility audit for screen readers, color contrast, and motor impairment.

**Scope**: `components/`, `constants/ThemeColors.ts`, `constants/Colors.ts`

**Review for**:
- Screen reader labels: are all interactive elements labeled with `accessibilityLabel` / `accessibilityRole`?
- Chart accessibility: do Skia charts in `components/ui/charts/` have text alternatives or narrative summaries?
- Color contrast: verify WCAG AA ratios (4.5:1 text, 3:1 large text/icons) against `ThemeColors.ts`
- Color-blind safety: is meaning conveyed through color alone anywhere (red/green for success/failure)?
- Touch targets: minimum 44x44pt for all interactive elements, larger during active workout
- Focus order: logical tab order in forms and modals
- Haptic fallbacks: are haptic-only signals paired with visual feedback?
- Dynamic type: does the app respect system font size preferences?

---

### Topic: `navigation` or `routing`

Review Expo Router navigation architecture.

**Scope**: `app/`, `components/ui/TabBar/`, `components/base/ScreenHeader/`

**Review for**:
- Route structure: is file-based routing clean? Any unnecessary nesting or route conflicts?
- Deep linking: are all routes reachable via URL scheme defined in `app.json`?
- Auth guard: does `(home)/` properly redirect unauthenticated users to `(auth)/`?
- Tab bar: custom `TabBar` component correctness, active state, badge indicators
- Screen headers: consistent `ScreenHeader` usage across all screens
- Modal presentation: are modals (sheets, overlays) properly layered and dismissible?
- Back navigation: does hardware/gesture back always work correctly?
- Navigation state: is workout state preserved during tab switches and background/foreground cycles?

---

## Review Standards

- Be brutally honest but constructive. Every criticism comes with a fix.
- Prioritize findings by real-world impact, not theoretical purity.
- Reference the actual codebase — read files, grep for patterns, verify claims before reporting.
- If a pattern is repeated across many files, report it once with a count, not once per file.
- Acknowledge good engineering. Devs need to know what to preserve, not just what to fix.
- Do NOT suggest adding comments, docstrings, or type annotations to code you haven't found issues with.
- Do NOT suggest tests unless the user specifically asked for test coverage review.
- Keep the report scannable: use tables for multi-file findings, bullet points for individual issues.

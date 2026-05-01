# Crank — App Architecture

## Tech Stack

- **Framework**: Expo 55 + React Native 0.83 + Expo Router (file-based routing)
- **Language**: TypeScript (strict mode, `@` path alias = project root)
- **Styling**: NativeWind 4 (Tailwind CSS for RN), class builder via `cn()` in `lib/utils/cn.ts`
- **State**: TanStack Query 5 (server state) + React Context (global state) + useState (local)
- **Backend**: Firebase 12 (Auth + Firestore + Storage + Analytics)
- **Charts**: @shopify/react-native-skia — custom in-house chart library at `components/ui/charts/`
- **Animations**: react-native-reanimated 4
- **Icons**: lucide-react-native
- **Fonts**: Geist (400 Regular, 600 SemiBold) via expo-google-fonts
- **Haptics/Audio**: expo-haptics + expo-audio
- **Health**: react-native-health (Apple HealthKit)
- **Monetization**: expo-superwall (paywalls)
- **Auth**: expo-apple-authentication (Apple Sign-In only)

## Directory Structure

```
app/                              # Expo Router file-based routing
├── (auth)/                       # Auth flow (sign-in screen)
├── (home)/                       # Main app (protected by AuthContext)
│   ├── (tabs)/                   # Bottom tab bar (Home, Analytics, Friends, Profile)
│   ├── analytics/                # Analytics drill-down screens
│   ├── exercises/                # Exercise library & detail ([id].tsx)
│   ├── settings/                 # Settings hierarchy (account, appearance, units, etc.)
│   ├── social/                   # User profiles, search, leaderboards ([userId].tsx)
│   ├── edit-profile.tsx          # Profile editing modal
│   └── share.tsx                 # Workout share card
├── _layout.tsx                   # Root layout with provider tree
└── index.tsx                     # Root redirect logic

components/
├── base/                         # Layout primitives (ThemedText, ThemedView, ScreenHeader, ErrorBoundary, OfflineBanner)
├── ui/                           # Reusable UI (Button, Card, BottomSheet, Skeleton, TabBar, NumberInput, etc.)
│   ├── charts/                   # In-house Skia chart library (LineChart, BarChart, MultiLineChart, Sparkline, CalendarHeatmap)
│   │   ├── primitives/           # ChartCanvas, YAxis, XAxis, TouchCursor, ChartHeader, Legend, ChartHighlight
│   │   ├── hooks/                # useChartGesture
│   │   ├── utils/                # scale, barPath, linePath, resample, monotoneCubic
│   │   └── tokens.ts             # Shared design tokens (colors, spacing, animation)
│   ├── icons/                    # Custom icons (CrankLogo, ActionBlitz, etc.)
│   └── skeletons/                # Skeleton loader variants
├── features/                     # Feature-specific components
│   ├── workout/                  # Workout tracking (largest feature area)
│   │   ├── WorkoutSelectSheet    # Template/quick workout selection
│   │   ├── WorkoutTrackerSheet   # Active workout UI
│   │   ├── steps/                # Multi-step flow (select, detail, tracking, cancel confirm)
│   │   └── ui/                   # Set rows, exercise items, timer banner, template buttons
│   ├── analytics/                # Analytics view components
│   ├── body/                     # Body mapping (DynamicBodyMap, Skia SVG renderers)
│   ├── level/                    # Level-up celebration (LevelUpScreen, LevelDetailsSheet)
│   ├── social/                   # Feed posts, friend cards, rankings, reactions
│   ├── badges/                   # Badge display/unlock
│   ├── profile/                  # Profile content, history list, workout detail
│   ├── streak/                   # Streak tracking
│   ├── exercises/                # Exercise management
│   └── settings/                 # Settings features
└── onboarding/                   # 4-step first-run flow (welcome → goals → plan → body map)

hooks/                            # Custom React hooks
├── useExercises.ts               # Cached exercise list (TanStack Query)
├── useWorkoutSession.ts          # Active set management
├── useWorkoutTracker.ts          # Workout completion & timing
├── useWorkoutSelectSheet.ts      # Template selection logic
├── useWorkoutTemplates.ts        # Template list
├── useTemplateGroups.ts          # Template folder hierarchy
├── useUnits.ts                   # kg/lbs conversion (user preference)
├── useTheme.ts                   # Theme consumer
├── usePremiumStatus.ts           # Superwall paywall gate
├── useSocial.ts                  # Social feed state
├── useLeaderboard.ts             # Leaderboard pagination
├── useFollowAction.ts            # Follow/unfollow mutations
├── useProfileData.ts             # User profile + stats
├── useFriendsExerciseProgress.ts # Friends' exercise comparison
├── useAppleHealth.ts             # HealthKit integration
├── useExerciseExpansion.ts       # UI expansion state
├── useAsyncState.ts              # Async state helper
└── useDebounce.ts                # Debounce utility

lib/
├── firebase/config.ts            # Firebase init with AppCheck
├── services/                     # Business logic (all Firestore queries live here)
│   ├── workoutService.ts         # Session CRUD, endWorkoutSession (plausibility + points + badges)
│   ├── workoutStatsService.ts    # Aggregate stats queries (volume, frequency)
│   ├── exerciseService.ts        # Exercise history, lookup, set entry CRUD
│   ├── templateService.ts        # Workout template CRUD
│   ├── templateGroupService.ts   # Template folder organization
│   ├── pointService.ts           # LP/MP calculation (per set, per session)
│   ├── plausibilityService.ts    # 2-layer weight validation gate
│   ├── profileService.ts         # User profile data
│   ├── bodyService.ts            # Body/muscle tracking + bodyweight entries
│   ├── badgeService.ts           # Badge rule evaluation + unlock
│   ├── authService.ts            # Apple auth flows
│   ├── followService.ts          # Follow/unfollow, mutual detection
│   ├── feedService.ts            # Social feed aggregation + notifications
│   ├── reactionService.ts        # Like/emoji reactions
│   ├── leaderboardService.ts     # Ranking queries
│   ├── streakService.ts          # Streak calculation
│   ├── analyticsService.ts       # Firebase Analytics events
│   ├── appleHealthService.ts     # HealthKit sync
│   ├── feedbackService.ts        # User feedback collection
│   ├── imageUploadService.ts     # Avatar/image uploads
│   └── deleteAccountService.ts   # Account deletion + data cleanup
├── constants/                    # App-wide constants
│   ├── exercises.ts              # 750+ exercise definitions
│   ├── Badges.ts                 # Badge definitions and rules
│   ├── BadgeImages.ts            # Badge asset mapping
│   ├── MuscleConfig.ts           # Muscle group taxonomy
│   ├── strengthRatios.ts         # Exercise 1RM/BW ratios (plausibility gate)
│   ├── queryKeys.ts              # TanStack Query key factory
│   ├── storageKeys.ts            # AsyncStorage keys
│   ├── SuperwallPlacements.ts    # Paywall placement IDs
│   └── mediaUrls.ts              # Media asset URLs
├── utils/                        # Utility functions
│   ├── cn.ts                     # Class name builder (clsx + tailwind-merge)
│   ├── unitConversion.ts         # toDisplay/toStorage unit conversion
│   ├── haptic.ts                 # Haptic feedback patterns
│   ├── dates.ts                  # Date formatting
│   ├── level.ts                  # Level XP thresholds
│   ├── muscleLevel.ts            # Muscle level calculations
│   ├── formatNumber.ts           # Number formatting
│   ├── chartNarrative.ts         # Accessibility chart descriptions
│   ├── celebrationSound.ts       # Audio for celebrations
│   ├── postWorkoutRefresh.ts     # Query invalidation after workout
│   ├── firestore.ts              # Firestore helpers
│   ├── exerciseFamilies.ts       # Exercise grouping logic
│   ├── avatars.ts                # Avatar utilities
│   ├── toast.ts                  # Toast notifications
│   ├── notifications.ts          # Push notification helpers
│   └── withTimeout.ts            # Promise timeout wrapper
├── wrappers/superwall.ts         # Superwall SDK wrapper + SuperwallProvider
└── mocks/                        # Mock data (used on for-social-media-posts branch)

contexts/                         # React Context providers
├── AuthContext.tsx                # Auth state, network detection, sign-in/sign-out, runIfOnline()
├── UserContext.tsx                # Cached profile + muscle points, refreshProfile(), refreshMusclePoints()
├── ThemeContext.tsx               # Light/dark mode preference
└── QueryProvider.tsx              # TanStack Query client + provider

types/                            # TypeScript type definitions
├── domain.ts                     # Core types (Exercise, WorkoutSession, Badge, WorkoutTemplate, etc.)
├── models.ts                     # Database model types
├── auth.ts                       # Auth types
├── health.ts                     # HealthKit types
├── components.ts                 # Component prop types
├── navigation.ts                 # Navigation types
└── svg.d.ts                      # SVG module declarations

constants/                        # Theme and layout constants
├── Colors.ts
├── ThemeColors.ts                # Primary, secondary, danger, success palettes
├── ThemePalettes.ts              # Complete light/dark theme definitions
├── ComponentTheme.ts             # Component-level theme tokens
├── TailwindColors.ts             # Tailwind color references
├── LayoutConstants.ts            # Spacing, radius, shadows
└── Levels.ts                     # Level XP progression thresholds
```

## Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `workoutSessions` | Workout session records (start/end times, exercises, points earned, plausibility audit) |
| `setEntries` | Individual logged sets (exercise, weight, reps, duration, unit, timestamp) |
| `workoutTemplates` | Saved workout routines (exercise lists, grouping, public/private) |
| `templateGroups` | Template folder organization (name, order, authorId) |
| `profiles` | User profile metadata (username, level, points, follower counts, avatar, social links) |
| `body` | Biometric data (age, gender, height, weight, musclePoints map) — keyed by userId |
| `bodyweightEntries` | Historical bodyweight logs |
| `follows` | Directed follow edges (followerId → followingId) |
| `followRequests` | Pending follow requests for private profiles |
| `likes` | Reactions on workout sessions (userId, sessionId, reactionType) |
| `notifications` | Activity notifications (new followers, reactions, requests) |
| `feedback` | User feedback submissions |
| `users/{userId}/badges` | Subcollection: unlocked badges per user |

## Navigation

**4 bottom tabs**: Home, Analytics, Friends, Profile — rendered by a custom `TabBar` component with a floating center action button for starting workouts.

**Tab layout** (`app/(home)/(tabs)/_layout.tsx`) manages:
- Workout lifecycle: WorkoutSelectSheet → WorkoutTrackerSheet → LevelUpScreen
- Persistent workout timer banner (shown above tabs during active workout)
- BodyweightSheet for quick weight logging

**Screen groups** under `(home)/`:
- `analytics/` — bodyweight, level-points, muscles, muscle/[id], workouts
- `exercises/` — exercise library with `[id]` detail screen
- `settings/` — account, appearance, feedback, health, notifications, point-system, privacy, units
- `social/` — network, search, `[userId]` profile, trophies

## Provider Tree

Root layout nests providers in this order (outermost → innermost):

```
ErrorBoundary
  GestureHandlerRootView
    SuperwallProvider
      QueryProvider (TanStack Query)
        ThemeProvider
          AuthProvider
            OfflineBanner
            UserProvider
              Slot (Expo Router)
              ToastManager
```

## State Management

**TanStack Query** (server state):
- Query key factory in `lib/constants/queryKeys.ts` (ANALYTICS_KEYS, PROFILE_KEYS, SHARE_KEYS, HISTORY_KEYS, LEADERBOARD_KEYS)
- Post-workout invalidation via `invalidatePostWorkoutQueries(queryClient, userId)` in `lib/utils/postWorkoutRefresh.ts`
- Long-lived data cached with staleTime (exercises cached ~1 hour)

**React Context** (global state):
- `AuthContext` — Firebase Auth state, offline detection via NetInfo, `runIfOnline()` gate
- `UserContext` — cached profile + muscle points, manual refresh functions
- `ThemeContext` — light/dark toggle

**Local state** (component-level):
- useState for form inputs, sheet visibility, transient UI state
- Active workout state managed locally in the tab layout via useState + callbacks

## Unit Handling

- User preference stored in profile: metric (kg) or imperial (lbs)
- `useUnits()` hook provides conversion functions
- **Storage is always kg** — `toStorage()` converts display values to kg before Firestore writes
- `toDisplay()` converts kg to user's preferred unit for rendering
- Plausibility checks operate in metric internally

## Point System

**Level Points (LP)**: Earned per set based on exercise base points, rep count, and weight relative to bodyweight. Accumulated to unlock levels (thresholds in `constants/Levels.ts`).

**Muscle Points (MP)**: Distributed per exercise across targeted muscle groups (defined in exercise configs). Tracked per muscle group in the `body` doc. Visualized via body map and radar chart.

Both calculated in `lib/services/pointService.ts` via `aggregateSessionPoints()`.

## Workout Flow

1. User taps center action button → `WorkoutSelectSheet` opens
2. Select template or start quick workout → `createSession()` in workoutService
3. `WorkoutTrackerSheet` opens → user logs sets (exercise, weight, reps)
4. Complete workout → `endWorkoutSession()` runs:
   - Plausibility validation (2-layer gate)
   - LP/MP calculation
   - Badge unlock checks
   - setEntries stored to Firestore
   - Profile level/points updated
   - Query cache invalidated
5. `LevelUpScreen` shown if points earned or badges unlocked

## Settings Screen Conventions

All `app/(home)/settings/*.tsx` screens follow the same patterns so the area reads as one product:

- **Section headers** use `<SectionLabel>` from `components/base/SectionLabel.tsx` (small caps, muted, wide tracking). Never an `h*` heading and never a custom text style — settings sections are visual dividers, not page titles.
- **Toasts** go through `toast` from `@/lib/utils/toast` (not `Toast` from `toastify-react-native` directly). Methods: `success`, `error`, `info`, `warn`, `hide`.
- **Row trailing icon** signals outcome:
  - `chevron` → navigates to a screen (default in `<SettingItem>`).
  - `external` → opens an external URL (Safari, store, etc.).
  - `none` → triggers an action with no navigation (modal, system overlay, sheet).
- **Screen header title** must match the index row label exactly. "Apple Health" both places, not "Health". "Send Feedback" both places, not "Feedback".
- **Padding**:
  - List-style screens (rows of `Card variant="border-bottom"`): scroll wrapper has `pt-lg`, NO `px-screen` — rows handle their own horizontal padding via `px-screen` on the Card.
  - Form-style screens (single-column inputs, descriptions): scroll wrapper has `px-screen pt-lg`.

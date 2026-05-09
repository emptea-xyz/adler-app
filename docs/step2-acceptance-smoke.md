# Step 2 Acceptance Smoke

Scope: `core-plan.md` Phase A Step 2 (`Onboarding + dual-profile + browse + push`)

## Preconditions
- Build and install on physical iOS device.
- Firebase project: `emptea-adler`.
- New test account available (no pre-existing `creatorProfile`/`brandProfile`).

## 1) Onboarding + Profile Gate
1. Sign in as a fresh user.
2. Complete flow: `Intro -> Basics -> Creator -> Brand -> Browse`.
3. Confirm app lands on Browse and tabs are not blocked.
4. In Firestore `profiles/{uid}` verify:
   - `creatorProfile != null`
   - `brandProfile != null`
   - `isCreator == true`
   - `isBrand == true`

Pass condition: onboarding writes both sides in lockstep and gate no longer blocks home routes.

## 2) Push Registration
1. Fresh install/state: launch app and observe in-app pre-prompt.
2. Tap enable, accept iOS notification permission.
3. Verify `profiles/{uid}.pushToken` is written.
4. Trigger test push to token and confirm device receives it.
5. Relaunch app and verify no repeated pre-prompt when already decided.

Pass condition: pre-prompt timing is correct, token is persisted, and push arrives.

## 3) Browse Role-Aware Behavior
1. Creator mode:
   - Browse title and feed show gigs.
   - Search works on loaded gig list.
   - Sort options: `Newest`, `Oldest`, `Price low->high`, `Price high->low`.
2. Brand mode:
   - Browse title and feed show services.
   - `Post gig` chip appears in header area.
   - Chip opens `/gigs/new`.
3. Category chips operate across both modes.

Pass condition: role mode flips feed kind and controls consistently.

## 4) Detail Screen Step-2 Parity
1. Open one service detail and one gig detail from Browse.
2. Confirm layout:
   - KPI top-left
   - status/kind pills top-right
3. Confirm primary CTA is disabled and labeled `Coming soon` on both screens.

Pass condition: no active buy/apply/award flow reachable from detail screens in Step 2.

## 5) Public Profile + Settings Profile
1. Open public profile by UID route and by handle route (`/profile/@handle`).
2. Confirm creator + brand sections both render, plus reputation block.
3. Open Settings -> Profile:
   - Basics, Creator, Brand sections prefilled.
   - Avatar change flow works.
   - DM contact fields save.
4. Save and verify Firestore writes without rule errors.

Pass condition: profile surfaces and edit route work end-to-end with valid writes.

## 6) Console Log Check
- During the full run, monitor Firestore and Functions logs for:
  - permission denials
  - write validation failures
  - unexpected function errors

Pass condition: no unexpected rejections/errors for Step-2 paths.

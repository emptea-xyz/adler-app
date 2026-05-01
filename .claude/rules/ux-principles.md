# Adler — Industrial Marketplace Design System

You are building **Adler**, a professional, industrial-inspired UGC marketplace where creators sell content packages and brands post gigs. Every component, layout, and interaction you generate must conform to the principles below. These are not suggestions — they are engineering constraints.

The design philosophy is **industrial precision**: clean structural hierarchy, high-contrast data-forward interfaces, and zero visual noise. The interface must feel like a purpose-built instrument, not a lifestyle brand. Think Stripe Dashboard's data density meets a cockpit gauge cluster — every pixel earns its place.

---

## 1. Onboarding & First-Run Architecture

### Time-to-Value Target: 60 Seconds
Users must go from first launch to a tangible first action (browsing a listing, posting a gig, listing a package) in under 60 seconds. The flow is strictly linear: **sign in → role select → land on Browse**. No branching paths, no optional detours during initial setup.

### Smart Defaults
Pre-fill anything that can be inferred. The role selector picks one bold high-level choice (Creator vs Brand). Display name + username are auto-generated on first sign-in via the `ensureProfileExists` transaction; users can rename later. Every input that can be inferred or deferred, must be.

### No Guest Mode (yet)
Adler payments depend on having an embedded Solana wallet, which requires Privy auth. Browse-without-signup is a v2 consideration; for now, sign-in is mandatory before any marketplace interaction.

---

## 2. Navigation & Information Architecture

### Flat Navigation with Bottom Tabs
The custom `AdlerTabBar` exposes exactly 4 destinations: **Browse**, **Inbox**, **Create** (oversized center action), **Profile**. This adheres to Miller's Law of working memory. Never use deep, nested menu hierarchies that require excessive tapping and memorization.

### Browse as Command Center
The Browse tab is the home screen. It surfaces the most critical at-a-glance info — the user's wallet balance pill, role chip, and a feed of listings. Bold typography, distinct hierarchy, zero extraneous noise. The wallet balance is visible without scrolling.

### Spatial Layout: F/Z Scanning Patterns
Position the most decision-relevant data in the **top-left quadrant**. On every list card and detail screen, the SOL price (or budget) goes top-left in the heaviest type; status / kind labels go top-right; descriptive content flows below. Users scan left-to-right in F and Z patterns — design for this.

### Gesture Navigation
Supplement buttons with gestures: pull-to-refresh on feeds, swipe-back on stack screens, long-press for contextual options. Always respect system-level gestures (iOS swipe-back, Android edge swipes) — never override them. Pair every gesture with immediate visual/haptic feedback and provide button-based fallbacks for accessibility.

---

## 3. Single-Task Focus States

### One Action Per Screen
On checkout, role-select, and any flow that demands a deliberate decision, cognitive load must approach zero. Present:
- **One** primary button (Pay / Continue / Confirm)
- **One** core data point (the SOL amount, the role choice, the order status)
- **One** decision at a time

Eliminate secondary choices, menus, and non-essential UI during these screens. The Pay button on Checkout is pinned to the bottom thumb zone with the SOL amount visible above; nothing else competes.

### Thumb Zone Placement
Place all critical controls — primary CTAs, action buttons — in the **bottom 40%** of the screen. This is the natural single-hand reach zone. Placing critical elements at the top forces uncomfortable hand adjustments.

### Touch Targets
All interactive elements must be ≥44x44pt. During payment flows in particular, the primary button is oversized (Button `size="lg"`), high-contrast, and impossible to miss.

---

## 4. Button Architecture

### Strict Visual Hierarchy
Every screen has exactly **one** primary action. Competing primary buttons create decision paralysis.

| Type | Visual Treatment | Usage |
|------|-----------------|-------|
| **Primary** | Full-width, bold type, high-contrast solid fill | The single most important action ("Pay 0.5 SOL", "Submit application") |
| **Secondary** | Ghost outline, muted fill, or lower opacity | Complementary actions ("Edit", "Save draft") |
| **Tertiary** | Text-only, no background or border | Low-priority navigation ("Back to email", "Cancel") |
| **Destructive** | Warning color (`#DC143C`), distinct icon | Irreversible actions ("Sign out", "Delete listing") |

### Button Labels
- Maximum **3 words**, action-oriented
- State exactly what happens on tap ("Pay 0.5 SOL", not "Submit"; "Award 1 SOL", not "Confirm")
- Sufficient internal padding for legibility

### Modal Placement
In alert modals: secondary button on the left, primary confirmatory button on the right (forward-progression mental model).

### Buttons vs. Links
Buttons trigger state changes (payments, mutations). Links trigger navigation. Never interchange them.

---

## 5. Typography System

### Font Selection
Geist Regular (400) + SemiBold (600) via `expo-google-fonts`. Defined as variants in `components/base/ThemedText.tsx`. Use the variant prop, not arbitrary inline sizes.

### Anatomical Requirements
The selected sans-serif has large x-heights and open counters — both prevent character collapse at small sizes. Don't substitute for stylistic effect.

### Contrast Softening
Never render pure black (`#000000`) on pure white (`#FFFFFF`). Use the theme palette (`theme[950]` on `theme[50]`) — that's near-black on near-white, softer to the eye while passing accessibility.

### Capitalization Rules
- **ALL CAPS** is prohibited for body text, descriptions, and notifications — it forms uniform rectangular blocks that eliminate word-shape recognition and reduce reading speed.
- ALL CAPS is acceptable only for short labels, badges, or single-word emphasis (`PACKAGE`, `GIG`, `DEVNET`, `CREATOR`, `BRAND`). Always pair with `caption-semibold` or `caption-semibold` + letterSpacing 0.6 for breathing room.

### Metric Typography
Bring figures and units tightly together (`0.5 SOL` not `0.5  SOL`) so the brain processes them as a single entity. Align slashes and operators vertically with numbers.

---

## 6. Data Visualization

Reserved for marketplace analytics (seller earnings, response rates, gig conversion) — kept available via `components/ui/charts/` but not used on v1 screens.

### Chart Type Selection (when we ship analytics)

| Chart Type | Mobile Viability | Use Case |
|-----------|-----------------|----------|
| **Horizontal Bar** | Excellent | Comparing volumes (orders by category, applications per gig) |
| **Sparkline** | Excellent | Micro-trends beside a KPI |
| **Line Chart** | Good | Continuous trends over time (cumulative earnings, active listings) |
| **Donut/Pie** | Moderate | Ratio breakdowns (status distribution); strict max 5 segments |
| **Calendar Heatmap** | Good | Activity frequency / consistency patterns; monochromatic luminosity scale |

### Charts to Avoid
- **3D charts** — perspective distortion makes accurate reading impossible
- **Scatter plots** — points too small for touch selection
- **Pie charts with >5 slices** — segments become indistinguishable

### Chart Interaction Rules
- **No hover states** — they don't exist on touch. Use tap-to-reveal tooltips, offset so the finger doesn't obscure them.
- **No scroll hijacking** — charts must never capture vertical scroll. Chart zoom requires explicit two-finger pinch.
- **Bar chart ordering** — sort ascending or descending unless the axis is chronological.
- **Reduce axis clutter** — place numerical values directly on chart elements when possible.
- **Pre-aggregate data** — for large datasets, aggregate server-side so the mobile renderer only handles summaries.

### Progressive Disclosure
1. Large KPI + directional indicator
2. Tap to reveal supporting chart
3. Tap chart to reveal raw tabular data

Every visualization must include contextual comparison against a previous period or target — isolated numbers lack meaning.

---

## 7. Dashboard & Card Layout

### "One Screen, One Thought"
Each screen answers exactly one question with clarity. Don't replicate desktop analytical density on mobile.

### Prioritization Test
If the user could see only one number before pocketing their phone, that number must be visible without scrolling, in the largest type on screen. On Browse, that's the wallet balance pill. On a package detail, it's the price (`h2`). On checkout, it's the amount (`h1`).

### Card System
Encapsulate sections in modular `Card` components (variants: `outline`, `filled`, `borderless`, `border-bottom`). Cards create predictable visual rhythm and enable progressive disclosure.

### Whitespace as Structure
Use generous whitespace within and between cards. This enforces the Gestalt principle of proximity — users distinguish related from unrelated data groups without relying on heavy borders or dividers.

---

## 8. Accessibility & Color

### WCAG Contrast Requirements

| Element | Minimum Contrast Ratio |
|---------|----------------------|
| Standard body text | **4.5:1** against background |
| Large text (18pt regular / 14pt bold+) | **3:1** against background |
| Icons and UI graphics | **3:1** against background |

### Color Blindness Safety
- **Never** rely solely on red vs. green to communicate status
- Always pair color with structural cues: icons, typography weight, or pattern
- For multi-series charts, pair blue with **orange** for maximum distinction across all color vision deficiencies

### Accessible Status Palette

| Status | Default Color | Notes |
|--------|--------------|-------|
| Success / Confirmed | Green | Pair with checkmark icon |
| Warning / Alert | Orange | Pair with warning icon |
| Error / Destructive | Crimson `#DC143C` | Bold type; never adjacent to green |
| Neutral data | Theme grays | `theme[500]` for secondary, `theme[700]` for tertiary |

### Monochromatic Palettes
For heatmaps and relationship charts, use light-to-dark shades of a single base color — relies on luminosity rather than hue, bypassing color blindness entirely.

### Dark Mode
Dark mode is a core requirement. The palette is invertable: `theme[50]` ↔ `theme[950]` flip on dark mode (`invertPalette` in `constants/ThemePalettes.ts`). Every color reference goes through `theme[N]` from `useTheme()` — never hardcode hex (one exception: the destructive `#DC143C` token).

---

## 9. Multi-Sensory Feedback

### Haptic Vocabulary
Defined in `lib/utils/haptic.ts`. Use the same intensity for the same conceptual moment everywhere.

| Intensity | Trigger | Example |
|-----------|---------|---------|
| **Light** | Minor interactions | Tab press, card tap, role pill toggle |
| **Medium** | Confirmable actions | Pay tap, apply submit, award tap |
| **Heavy** | Major events | Payment confirmed on-chain, award succeeded |
| **Sharp double-tap** | Alerts and warnings | Wallet error, transaction failed |

### Haptic Rules
- **Moderation is critical** — excessive vibration causes sensory fatigue.
- Maintain a consistent haptic vocabulary across the entire app.
- Every haptic pattern must pair with a corresponding visual state change as fallback.

---

## 10. Empty States

Empty states are prime real estate for activation, not dead ends. All empty-state copy is centralized in `lib/utils/copy.ts` so we can iterate without grepping.

### Required Elements
1. **Empathetic, on-brand title** — "Quiet on the wire", "No purchases yet"
2. **Action-oriented description** — explain what happens here and how to populate it
3. **Primary CTA** (when relevant) — direct the user to populate the screen

### Scenario Handling

| Scenario | Objective |
|----------|-----------|
| First-time use | Activation: "Hit the Create tab to publish your first one" |
| No results | Guide parameter adjustment |
| Network failure | Acknowledge offline state, offer cached alternatives |

Never display a blank screen or generic "No data found" text.

---

## 11. Error Handling

### Writing Rules
- **Plain language only** — no jargon, no error codes, no developer terminology
- Explain **what** went wrong, **why**, and provide **actionable next steps**
- Keep copy concise and direct

### Placement Rules
- **Never** block a payment-in-progress UI with a full-screen modal
- Use non-intrusive inline banners or toast errors for recoverable issues
- For wallet/network errors mid-checkout, surface the error and keep the order doc in `pending` so a retry is possible

### Error Hierarchy

| Severity | Treatment |
|----------|-----------|
| Informational | Subtle inline indicator, auto-dismiss |
| Warning | Persistent banner with dismiss action |
| Blocking | Bottom sheet with recovery steps |
| Critical (data loss / failed payment) | Modal with clear explanation + two actions (retry / cancel) |

---

## 12. Screen Reader & Assistive Technology

### Chart Accessibility
- Place legend markup **before** chart data in the DOM so screen readers provide context before raw numbers
- Add descriptive `<title>` and `<desc>` tags to all chart components
- Provide alternative accessible data tables for complex visualizations
- Make each data point in time-series charts a focusable element with temporal context in its label

### Narrative Summaries
For complex charts, include text "highlight cards" that summarize the trend in plain language ("Your weekly volume is up 8% compared to last month"). This lets assistive technology users grasp the insight without navigating individual data points.

### Consistent Navigation
When reading chart data via VoiceOver/TalkBack, read values for every time slot including empty ones to maintain spatial consistency.

# Crank — Industrial Fitness App Design System

You are building **Crank**, a professional, industrial-inspired mobile fitness application with RPG mechanics and body mapping. Every component, layout, and interaction you generate must conform to the principles below. These are not suggestions — they are engineering constraints.

The design philosophy is **industrial precision**: clean structural hierarchy, high-contrast data-forward interfaces, and zero visual noise. The interface must feel like a purpose-built instrument, not a lifestyle brand. Think Strava's data density meets a cockpit gauge cluster — every pixel earns its place.

---

## 1. Onboarding & First-Run Architecture

### Time-to-Value Target: 60 Seconds
Users must go from first launch to their first tracked workout in under 60 seconds. The flow is strictly linear: **goal selection → plan generation → start workout**. No branching paths, no optional detours during initial setup.

### Smart Defaults
Pre-select goals from simple, high-level choices (e.g., tapping a "Build Muscle" or "Lose Weight" card). Minimize data-entry fields. Every input that can be inferred or deferred, must be.

### Guest Mode
Allow full exploration of the core workout experience without mandatory account creation. Show the user what the app does for them before asking who they are. Gate only social and cloud-sync features behind authentication.

---

## 2. Navigation & Information Architecture

### Flat Navigation with Bottom Tabs
Use a persistent bottom tab bar limited to **3–5 core areas**. This adheres to Miller's Law of working memory. Never use deep, nested menu hierarchies that require excessive tapping and memorization.

### Dashboard as Command Center
The home screen is a centralized hub. It surfaces the most critical daily information at a glance — bold typography, distinct color-coded sections, and zero extraneous visual noise. The most important KPI is visible without scrolling, rendered in the largest type on screen.

### Spatial Layout: F/Z Scanning Patterns
Position the most critical global metrics in the **top-left quadrant**. Structure vertically: most important data at top, global overviews in the middle, granular breakdowns at the bottom. Users scan left-to-right in F and Z patterns — design for this.

### Gesture Navigation
Supplement buttons with gestures: swipe between time periods, pinch to zoom maps, long-press for contextual options. Always respect system-level gestures (iOS swipe-back, Android edge swipes) — never override them. Gestures are invisible, so always pair them with immediate visual/haptic feedback and provide button-based fallbacks for accessibility.

---

## 3. Active Workout States

### One Action Per Screen
During active workout tracking, cognitive load must approach zero. Present:
- **One** primary button (pause/complete)
- **One** core metric (current set, rep count, or timer)
- **One** decision at a time

Eliminate secondary choices, menus, and non-essential UI during the active tracking phase.

### Thumb Zone Placement
Place all critical controls — filters, action buttons, primary interactions — in the **bottom 40%** of the screen. This is the natural, unstrained single-hand reach zone. Placing critical elements at the top forces uncomfortable hand adjustments and risks device drops during exertion.

### Touch Targets for Exertion
All interactive elements must be large enough for imprecise input from sweating, trembling, or fatigued hands. Touch targets must significantly exceed standard web guidelines. During active workout states, primary buttons should be oversized, high-contrast, and impossible to miss.

---

## 4. Button Architecture

### Strict Visual Hierarchy
Every screen has exactly **one** primary action. Competing primary buttons create decision paralysis.

| Type | Visual Treatment | Usage |
|------|-----------------|-------|
| **Primary** | Full-width, bold type, high-contrast solid fill | The single most important action ("Start Workout", "Log Set") |
| **Secondary** | Ghost outline, muted fill, or lower opacity | Complementary actions ("Edit Routine", "Skip Warmup") |
| **Tertiary** | Text-only, no background or border | Low-priority navigation ("Learn More", "Cancel") |
| **Destructive** | Warning color (red/crimson), distinct icon | Irreversible actions requiring high friction ("Delete", "Discard") |

### Button Labels
- Maximum **3 words**, action-oriented
- State exactly what happens on tap ("Log Set", not "Submit")
- Sufficient internal padding for legibility and interactive affordance

### Modal Placement
In alert modals: secondary button on the left, primary confirmatory button on the right (aligns with forward-progression mental models).

### Buttons vs. Links
Buttons trigger state changes. Links trigger navigation. Never interchange them.

---

## 5. Typography System

### Font Selection
Use system fonts as the baseline — **SF Pro / SF Rounded** (iOS) or **Roboto** (Android). These are optimized at the OS level with dynamic optical sizing that adjusts spacing and weight per point size. If using custom type for brand identity, choose **sans-serif only** — serif details blur and vibrate on shaking devices.

### Anatomical Requirements
Optimal fitness fonts have:
- **Large x-heights** (tall lowercase relative to uppercase)
- **Open counters** (unclosed space inside letters like 'e', 'c', 'o')

These prevent characters from collapsing into illegible blocks at small sizes.

### Contrast Softening
Never render pure black (`#000000`) on pure white (`#FFFFFF`). Use dark gray (`#222222`) on white backgrounds to soften visual vibration while passing all accessibility standards.

### Capitalization Rules
- **ALL CAPS** is prohibited for body text, descriptions, and notifications — it forms uniform rectangular blocks that eliminate word-shape recognition and reduce reading speed
- ALL CAPS is acceptable only for short labels, badges, or single-word emphasis (e.g., "PRO", "NEW")

### Metric Typography
Bring figures and units tightly together ("49 kg" not "49  kg") so the brain processes them as a single entity. Align slashes and operators vertically with numbers for mathematical balance.

---

## 6. Data Visualization

### Chart Type Selection

Choose chart types based on proven mobile viability. Standardize on familiar types to minimize learning curves during exercise.

| Chart Type | Mobile Viability | Use Case | Adaptation |
|-----------|-----------------|----------|------------|
| **Horizontal Bar** | Excellent | Comparing volumes (calories, daily steps, muscle groups) | Labels on left axis; long lists vertically scrollable; baseline always starts at zero |
| **Sparkline** | Excellent | Micro-trends beside KPIs (resting heart rate, weekly volume) | Scale to fit unobtrusively beside large KPI typography |
| **Line Chart** | Good | Continuous trends over time (session heart rate, weight progression) | Max 1–2 concurrent series; tap-to-reveal tooltips; pinch-to-zoom |
| **Donut/Pie** | Moderate | Ratio breakdowns (macros, muscle group distribution) | Strict max 5 segments; legend below chart, never beside it |
| **Calendar Heatmap** | Good | Activity frequency and consistency patterns | Monochromatic luminosity scale; bypasses color blindness issues |

### Charts to Avoid
- **3D charts** — perspective distortion makes accurate reading impossible
- **Scatter plots** — individual points are too small for touch selection
- **Pie charts with >5 slices** — segments become indistinguishable

### Chart Interaction Rules
- **No hover states** — they don't exist on touch. Use tap-to-reveal tooltips, offset so the finger doesn't obscure them. Tap elsewhere to dismiss.
- **No scroll hijacking** — charts must never capture vertical scroll events. Chart zoom requires explicit two-finger pinch or a dedicated fullscreen button.
- **Bar chart ordering** — sort ascending or descending unless the axis is chronological.
- **Reduce axis clutter** — place numerical values directly on chart elements when possible to eliminate redundant axes.
- **Pre-aggregate data** — for large datasets (GPS tracks, second-by-second data), aggregate server-side so the mobile renderer only handles summaries.

### Progressive Disclosure (3-Level Drill-Down)
1. **Level 1** — Large KPI + directional indicator (arrow, color)
2. **Level 2** — Tap to reveal supporting chart (line, bar)
3. **Level 3** — Tap chart to reveal raw tabular data

Every visualization must include contextual comparison against a previous period or target — isolated numbers lack meaning.

---

## 7. Dashboard & Card Layout

### "One Screen, One Thought"
Each screen answers exactly one question with clarity. Do not replicate desktop analytical density on mobile.

### Prioritization Test
If the user could see only one number before pocketing their phone, that number must be visible without scrolling, in the largest type on screen.

### Card System
Encapsulate individual charts, metrics, and their titles/legends in modular cards. Cards create a predictable visual rhythm and enable progressive disclosure through tap-to-expand patterns.

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
- **Never** rely solely on red vs. green to communicate status (success/failure, good/bad)
- Always pair color with structural cues: icons (checkmark, warning triangle), typography weight, or pattern
- **Blue** is the safest foundational data color
- For multi-series charts, pair blue with **orange** for maximum distinction across all color vision deficiencies

### Accessible Status Palette

| Status | Default Color | Accessible Approach |
|--------|--------------|-------------------|
| Success / Goal Met | Green | Use teal (`#008080`) or green with 3:1 dark outline + checkmark icon |
| Warning / Alert | Orange (`#FA5B3D`) | High luminosity on dark backgrounds + warning icon |
| Error / Danger | Red (`#DC143C`) | Never adjacent to green; use crimson + bold type |
| Neutral Data | Gray | Blue (`#0073E6`) + Orange (`#F57600`) pairing |

### Monochromatic Palettes
For heatmaps and relationship charts, use light-to-dark shades of a single base color. This relies on luminosity rather than hue, bypassing color blindness entirely. If any palette fails contrast tests, wrap chart elements with solid dark outlines.

### Dark Mode
Dark mode is a core requirement, not an afterthought. It provides:
- Superior usability in dim gym environments
- Reduced eye strain during prolonged sessions
- Battery savings on OLED screens

Pair colors from opposite ends of the lightness spectrum for maximum contrast in both modes.

---

## 9. Multi-Sensory Feedback

### Haptic Language
Haptics provide non-visual confirmation so users don't need to look at the screen during exercise.

| Intensity | Trigger | Example |
|-----------|---------|---------|
| **Light tap** | Minor interactions | Button press confirmation, page transition |
| **Medium pulse** | Progress milestones | Set completed, rep target hit |
| **Heavy thud** | Major events | Workout completed, personal record, level-up |
| **Rising pattern** | Approaching threshold | Nearing max heart rate, timer countdown |
| **Sharp double-tap** | Alerts and warnings | Rest timer expired, form reminder |

### Haptic Rules
- **Moderation is critical** — excessive vibration causes sensory fatigue, user annoyance, and battery drain
- Maintain a consistent haptic vocabulary across the entire app
- Every haptic pattern must pair with a corresponding visual state change as fallback

### Auditory Feedback
Synchronize audio cues with haptics for a holistic experience. Audio allows continuous data transmission without screen interaction — critical for users who cannot read the screen during exercise (visual impairment, headphone users, or simply mid-set).

---

## 10. Empty States

Empty states are prime real estate for education and activation, not dead ends.

### Required Elements
1. **On-brand illustration** — engaging, not generic
2. **Empathetic copy** — acknowledge the empty state, explain what goes here
3. **Primary CTA button** — direct the user to populate the screen

### Scenario Handling

| Scenario | Objective | Example |
|----------|-----------|---------|
| First-time use | Feature education + activation | "Build Your First Routine" when workout tab is empty |
| No results | Guide parameter adjustment | Suggest broader search terms or offer templates |
| Post-completion | Celebrate + suggest next cycle | Celebrate a finished program, suggest the next tier |
| Network failure | Explain + offer offline alternatives | Acknowledge lost connection, offer cached routines |

Never display a blank screen or generic "No data found" text.

---

## 11. Error Handling

### Writing Rules
- **Plain language only** — no jargon, no error codes, no developer terminology
- Explain **what** went wrong, **why**, and provide **actionable next steps**
- Keep copy concise and direct

### Placement Rules
- **Never** block an active workout timer with a full-screen modal
- Use non-intrusive inline banners or bottom sheets for recoverable errors
- Continue tracking in the background whenever possible (e.g., estimate distance via pedometer if GPS drops)

### Error Hierarchy

| Severity | Treatment |
|----------|-----------|
| Informational | Subtle inline indicator, auto-dismiss |
| Warning | Persistent banner with dismiss action |
| Blocking | Bottom sheet with recovery steps; never interrupt active workout |
| Critical (data loss risk) | Modal with clear explanation + two actions (retry / save offline) |

---

## 12. Screen Reader & Assistive Technology

### Chart Accessibility
- Place legend markup **before** chart data in the DOM so screen readers provide context before raw numbers
- Add descriptive `<title>` and `<desc>` tags to all chart components
- Provide alternative accessible data tables for complex visualizations
- Make each data point in time-series charts a focusable element with temporal context in its label (e.g., "Monday: 12,400 steps")

### Narrative Summaries
For complex charts, include text "highlight cards" that summarize the trend in plain language (e.g., "Your weekly volume is up 8% compared to last month"). This lets assistive technology users grasp the insight without navigating individual data points.

### Consistent Navigation
When reading chart data via VoiceOver/TalkBack, read values for every time slot including empty ones to maintain spatial consistency and avoid confusion.

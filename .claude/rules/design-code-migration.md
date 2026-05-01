# Adler — Design ↔ Code Migration

Rules for transcribing between the Figma canvas and the React Native codebase in either direction. Follow these to avoid the visual drift that makes the two sides stop matching each other.

> Adler doesn't yet have a canonical Figma file. These rules apply once design work begins. Until then, treat them as the bar to clear when interpreting design references shared via screenshots or specs.

---

## 0. Rule Zero: SVGs Are Always Taken 1:1

**No exceptions. No approximations. No simplifications. No "close enough."**

An SVG is a piece of path data. When migrating between code and design, transfer **the exact path strings, verbatim**. Never redraw, retrace, round off, or simplify any part of any SVG — not an icon, not a logo, not a decorative glyph.

If you can't access the source path data, **stop and find it** (grep the repo, read the component file, copy from the canonical lucide source). Do not substitute a look-alike and move on.

Acceptable:
- `figma.createNodeFromSvg(rawSvgString)` with the literal path from the source file
- `figma.createVector()` with `vectorPaths.data` copied verbatim
- Exporting a Figma vector node's SVG and pasting the path strings into a Skia `<Path>` or inline `<Svg>`

Forbidden:
- Drawing a "simplified silhouette" because the original has many paths
- Using Figma's pen tool to recreate an icon by eye
- Rewriting path commands by hand
- Replacing with a "visually close" icon from a different set

If a migration step would require drawing rather than copying, that's the signal you're off the rails — go back and find the source path data.

---

## 1. Universal Principles

- **Inspect before you transcribe.** Read the other side's source of truth first — the component file, or Figma's `get_metadata` + `get_screenshot` — plus the shared design tokens (`constants/ThemePalettes.ts`, `constants/LayoutConstants.ts`, `constants/TailwindColors.ts`). Never eyeball a value you can look up.
- **Device frame first.** iPhone 15 Pro: 393×852, status bar 59pt, home indicator 34pt. Every screen mockup reserves both safe areas, not just the content area.
- **Build incrementally, verify after each step.** Tokens → frames → components → content. Screenshot/render and diff against the other side before moving on. Fix drift before it compounds.
- **Walk the tree in the same order.** JSX child order = Figma layer order = on-screen render order (top-to-bottom, left-to-right). If the two sides diverge in order, one of them is wrong.

---

## 2. Assets Are Copied, Never Redrawn

**Never approximate a graphic.** If the app renders a specific vector or raster asset, migrate the exact asset — don't substitute a look-alike. A simplified silhouette is a different design, not the same design.

### Vectors — 1:1 path transfer (see also: Rule Zero)

- **Always find the source path data first.** Grep the repo for the component name, open the file, copy the literal path strings.
- In Figma: paste the raw SVG into `figma.createNodeFromSvg()`, or use `figma.createVector()` with `vectorPaths`. Preserve the original `viewBox` aspect ratio and `rescale()` to target size. Nothing gets retyped.
- Lucide icons: grab the canonical SVG from lucide's source and import verbatim. Match `strokeWidth`, `strokeLinecap`, `strokeLinejoin` to the code's usage (default in RN is `strokeWidth={2}`, rounded caps/joins).
- Multi-part assets: extract **every** sub-path from the source. Missing one path leaves a visible gap — Rule Zero says all of them, not most of them.
- Going Figma → code: export the Figma node as SVG, paste the path strings into a Skia `<Path>` or inline component. Don't retrace geometry by hand.

### Raster — copy the file, don't recreate

- If an asset lives as a PNG in `assets/` or as a remote URL, **copy the file directly** — upload the same PNG into Figma (drag-in, or `figma.createImage()` → `imageHash`). Don't vectorize or recreate it.
- Going Figma → code: export at 1x/2x/3x from Figma and commit under `assets/`, referenced via `require()`. Don't re-encode or crop manually.

---

## 3. Code → Figma (rebuilding the canvas from source)

### Layout mapping

| React Native | Figma |
|---|---|
| `flex: 1` | `layoutSizingHorizontal/Vertical = 'FILL'` (set **after** `appendChild`) |
| `flexDirection: 'row'` | auto-layout frame, `layoutMode = 'HORIZONTAL'` |
| `gap: 8` | `itemSpacing: 8` on auto-layout frame |
| `paddingHorizontal: 16, paddingVertical: 8` | `paddingLeft/Right = 16, paddingTop/Bottom = 8` |
| `position: 'absolute'` + anchor | child `layoutPositioning = 'ABSOLUTE'` with explicit `x`/`y` |
| NativeWind `rounded-full` | `cornerRadius = 9999` |
| Skia `LinearGradient` top→bottom | `gradientTransform = [[0,1,0],[-1,0,1]]` |
| Skia `Shadow` / RN `shadow*` | `effects` with `DROP_SHADOW` |

### Sizing-mode pitfalls

- `primaryAxisSizingMode` defaults to `'AUTO'` — a frame will **hug its children** even after `resize()`. Set to `'FIXED'` when you want an explicit size.
- `layoutSizingHorizontal/Vertical = 'FILL' | 'HUG'` can only be set **after** the child is appended to its auto-layout parent. Setting before throws.
- `resize()` resets sizing modes to `FIXED`. Set sizing modes *after* the final `resize()`.

### SVG import gotchas

- `figma.createNodeFromSvg` with decimal `width`/`height` attributes (e.g. `width="32.7"`) silently produces an **empty frame**. Fix: use integer `viewBox`, omit `width`/`height`, then `rescale()` to the target size.
- The import returns a *frame* with vector children. When recoloring, only target `type === 'VECTOR'` — applying a fill to the parent frame produces a solid block.
- Stroke-based icons (lucide) → set `strokes`, clear `fills`, `strokeWeight = 2`, `strokeCap/Join = 'ROUND'`.
- Fill-based icons → set `fills` on vectors, clear `strokes`.

### Fonts

- Geist isn't a default Figma font. Use **Inter** as substitute. Style names have a space: `"Semi Bold"`, not `"SemiBold"`; same for `"Extra Bold"`.
- `await figma.loadFontAsync(...)` at the top of every `use_figma` script — fonts don't persist between calls.

### Colors

- Figma paint `color` uses 0–1 RGB (`{ r, g, b }`). No `a` field on a paint color — alpha lives on `paint.opacity`, or on gradient stops.
- Map via theme token, not hex: `theme[200]` → `#e5e5e5`, `theme[950]` → `#0a0a0a`. Source of truth: `constants/ThemePalettes.ts`.
- Accents use `TailwindColors.<name>[500]` — same token name in Figma and code.

### Floating elements

- Anything `position: 'absolute'` in RN floats *over* content (tab bar, toasts, sheets). In Figma, make it an absolutely-positioned sibling via `layoutPositioning = 'ABSOLUTE'` so auto-layout doesn't shrink other children around it.
- Reserve the floating element's visual space mentally — don't clip body content for it, let it overlap.

---

## 4. Figma → Code (building RN from the canvas)

### Read Figma first

1. `get_metadata` on the frame → structure, counts, x/y, sizes.
2. `get_screenshot` for the visual target.
3. Inspect variable collections — Figma colors map to `ThemePalettes`, spacing/radius to `LayoutConstants`.
4. Resolve text styles — Inter in Figma ↔ Geist in code.

### Translation mapping

| Figma | React Native |
|---|---|
| Auto-layout `HORIZONTAL` | `flexDirection: 'row'` |
| Auto-layout `VERTICAL` | default (or `flexDirection: 'column'`) |
| `itemSpacing: 16` | `gap: 16` / NativeWind `gap-4` |
| `paddingLeft/Right/Top/Bottom` | `paddingHorizontal`, `paddingVertical`, or individual props |
| `layoutSizingHorizontal = 'FILL'` | `flex: 1` / `flexGrow: 1` |
| `layoutSizingVertical = 'HUG'` | default — no explicit height |
| Corner radius `9999` | `rounded-full` / `borderRadius: 9999` |
| Gradient top→bottom | `@shopify/react-native-skia` `LinearGradient` `start={vec(0,0)} end={vec(0,h)}` |
| Drop shadow effect | `shadow*` props or Skia `<Shadow />` |
| Absolute-positioned child | `position: 'absolute'` + `top/bottom/left/right` |

### Constants first, literals never

- Use `TAB_BAR_HEIGHT`, `BottomInset.*` from `constants/LayoutConstants.ts` — never hardcode magic numbers.
- Use `theme[n]` from `useTheme()` — never hardcode hex (one exception: the destructive `#DC143C` token, which is intentionally fixed).
- Use `TailwindColors.*` for non-theme accents.
- If a needed constant doesn't exist, add it in `constants/`. Don't duplicate a literal across files.

### Safe areas

- Use `useSafeAreaInsets()` — never hardcode `59` (status bar) or `34` (home indicator).
- Top-edge content: `<SafeAreaView edges={['top']}>` or offset by `insets.top`.
- Bottom-edge content (tab bar, floating sheets): add `insets.bottom` to height and use `paddingBottom: insets.bottom` to push UI above the home indicator.

---

## 5. Pre-flight Checklist (both directions)

- [ ] Source tokens identified (`ThemePalettes`, `LayoutConstants`, `TailwindColors`, text styles)
- [ ] Safe areas reserved (status bar top, home indicator bottom)
- [ ] Floating elements marked `layoutPositioning = 'ABSOLUTE'` / `position: 'absolute'` — not baked into layout flow
- [ ] Fonts loaded (`loadFontAsync`) / fallback decided (Geist ↔ Inter)
- [ ] Colors referenced by token, not hex
- [ ] Auto-layout ↔ flex semantics match (direction, gap, padding, sizing modes)
- [ ] **Every vector asset imported 1:1 from its source path data — no approximations**
- [ ] **Every raster asset copied from the source file — no redraws, no re-encodes**
- [ ] Screenshot/render compared against the other side before moving to the next element

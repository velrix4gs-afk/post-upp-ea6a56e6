
# iOS 26 "Liquid Glass" — Apply to Post Up + Standalone Artifact

Two deliverables in one pass: (1) layer the Liquid Glass visual language onto the live Post Up React app without breaking existing logic, and (2) generate a single-file HTML reference prototype at `/mnt/documents/liquid-glass-postup.html` you can download and revisit.

## 1. Standalone artifact (downloadable HTML)

File: `/mnt/documents/liquid-glass-postup.html`

Single self-contained file containing the full spec from the brief:
- Tailwind CDN + Phosphor Icons CDN + system-font `@font-face` swap stack
- Ambient dark canvas (`#020617`) with animated radial backlit blobs (blur ≥ 90px, infinite pulse)
- SVG `<filter id="goo">` with `feGaussianBlur stdDeviation=6` + `feColorMatrix` alpha boost (matrix `0 0 0 18 -8`) for gooey metaball notifications, story bubble fusion, and tab indicator morph
- Spring cubic-beziers exposed as CSS vars: `--spring: cubic-bezier(0.25,1.15,0.35,1.15)`, `--dampen: cubic-bezier(0.175,0.885,0.32,1.275)`, `--collapse: cubic-bezier(0.16,1,0.3,1)`
- Three glass plate tiers (Standard / Smoky / Clear) as utility classes with `backdrop-filter: blur() saturate()` + thin borders
- `will-change: transform, opacity` + `-webkit-overflow-scrolling: touch` on scroll viewports, tab bar, moving plates
- Components: glass header w/ AI trigger, conic-gradient Vibe Ring story hub, feed cards, morphing bottom tab capsule (scroll-down collapse → scroll-up expand, JS-driven active dot morph), comments drawer (translate-y-full → 0 with drag handle + overlay tap close)
- AI Agent core: command search bar that parses `compact|cinematic|quiet` queries, mutates a `data-mode` attribute on `<html>`, logs to a floating telemetry console, and emits micro-toasts
- Like animation: scale+rotate spring, count in `k` format, toast notification
- All animation via `transform` / `opacity` only — no layout thrash

After writing, emit:
```
<presentation-artifact path="liquid-glass-postup.html" mime_type="text/html"></presentation-artifact>
```

## 2. Apply to the Post Up React app

Goal: introduce Liquid Glass as an **additive theming layer** — no business logic, routes, hooks, Supabase calls, or component structure touched. UI-only per project rules.

### 2a. Design tokens & primitives (`src/index.css`)

Add new CSS variables and utility classes scoped under a `data-skin="liquid-glass"` attribute on `<html>` so we can ship it without forcibly overriding existing themes:

- `--lg-bg: 222 47% 4%` (slate base)
- `--lg-spring`, `--lg-dampen`, `--lg-collapse` cubic-beziers
- `.lg-plate`, `.lg-plate-smoky`, `.lg-plate-clear` — backdrop-filter glass tiers using semantic HSL tokens (no raw hex in components per design rules)
- `.lg-ambient` — fixed full-viewport layer with two/three animated radial blobs using the existing accent token (`--primary`) + a secondary hue; `@keyframes lg-pulse` shifts hue/translate over 18s
- `.lg-spring`, `.lg-dampen` transition helpers
- `.lg-ring` — conic-gradient ring for story avatars (fuchsia → indigo → cyan via HSL)
- `.lg-tap` — `active:scale-[0.92] transition-transform` with spring curve
- Global `will-change` + `transform: translateZ(0)` on `.lg-accelerated`
- Inline SVG `<filter id="lg-goo">` injected once via a tiny `LiquidGlassRoot` component

### 2b. Theme activation

- Extend `useAppearanceSync.ts` to read a new `app_skin` localStorage key (default unchanged) and set `data-skin` on `<html>`. Anti-flash script in `index.html` reads the same key before paint — same pattern already used for theme/font/layout/accent. No DB change; this is local-only.
- Add a Settings → Appearance toggle "Liquid Glass (iOS 26)" in `src/pages/SettingsPage.tsx` that writes `app_skin` and updates the attribute. Default OFF so existing users see no change unless they opt in.

### 2c. Component skinning (additive class swaps only)

When `data-skin="liquid-glass"` is active, CSS rules in `index.css` retheme these existing components without editing their JSX structure:

- `BottomNavigation.tsx` capsule (`bg-background/80 backdrop-blur-lg border-border/30`) → glass plate styling, spring transition curve, scroll-collapse via existing `isVisible` state (already wired, just restyle)
- `FeedTabs.tsx` sticky header → smoky glass plate + animated underline using spring curve
- `Stories.tsx` avatar ring → conic-gradient ring via `[data-skin="liquid-glass"] .story-ring` selector
- `Feed.tsx` post cards (`PostCardModern`) → standard glass plate background, hover lift with spring
- Drawers / Dialogs (Radix) → smoky glass via `[data-skin="liquid-glass"] [data-radix-popper-content-wrapper]` + drawer content selectors
- Toasts (sonner) → clear glass plate
- App root: render `<div className="lg-ambient" aria-hidden />` once inside `App.tsx` (conditional on `data-skin`), z-index behind content

All changes are restricted to `className` additions wrapped behind the `data-skin` selector. No JSX deletions. No state/logic edits. No new components beyond `LiquidGlassRoot` (filter SVG + ambient layer).

### 2d. AI agent layout modes (optional, opt-in)

Add three layout modes (`compact` / `cinematic` / `quiet`) wired through the existing `app_layout_mode` localStorage key already handled by `useAppearanceSync`. Extend `data-layout` CSS rules in `index.css` to cover the new values:
- `[data-layout="compact"]` → tighter paddings, smaller radii, hidden hero media
- `[data-layout="cinematic"]` → expanded media, richer gradients on cards
- `[data-layout="quiet"]` → 75% opacity, desaturated, badges hidden

Surface these in the Settings appearance panel next to the existing layout choices. No new state machine; reuses the sync hook.

## Files touched

Created:
- `/mnt/documents/liquid-glass-postup.html` (artifact)
- `src/components/LiquidGlassRoot.tsx` (SVG filter + ambient layer; rendered once in `App.tsx`)

Edited:
- `src/index.css` — tokens, utilities, `[data-skin="liquid-glass"]` skinning rules, new `[data-layout]` modes
- `index.html` — anti-flash block reads `app_skin`, applies `data-skin`
- `src/hooks/useAppearanceSync.ts` — read/apply `app_skin`
- `src/pages/SettingsPage.tsx` — Liquid Glass toggle + extended layout options
- `src/App.tsx` — mount `<LiquidGlassRoot />` once

Not touched: routing, auth, Supabase, edge functions, messaging logic, hooks beyond `useAppearanceSync`, any component's JSX structure or business logic.

## Technical guarantees

- Opt-in by default → zero visual regression for current users
- All animations on `transform`/`opacity` only → 120Hz safe
- HSL tokens only in components; raw rgba glass values stay inside `index.css` utility classes
- No DB writes, no schema changes, no new API surface

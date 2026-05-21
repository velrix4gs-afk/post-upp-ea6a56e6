
# Story Creation Revamp — Instagram-style (no IG colors)

## Problems today
1. The global **RightSlidePanel** FAB (`fixed top z-40`) and top **Navigation** bar (`z-50`) bleed over the full-screen `/create/story` editor — that's the "profile button overlay" the user sees.
2. The active page (`src/pages/CreateStoryPage.tsx`) is a half-finished version: tools render in a separate `<StoryTextOverlay>` full-screen view, the share/audience header sits over the canvas, the filter strip is hidden behind the side toolbar, text/draw/sticker editors aren't wired into the same preview, and the duplicate `src/components/CreateStoryPage.tsx` (not routed) is actually the more complete one.
3. Filters preview thumbnails are blank, no live tap-feedback, no pinch/drag for overlays, no clear "Next → Share" flow.

## Goals
- IG-style flow & ergonomics (camera/gallery → edit canvas → filters carousel → stickers/text/draw → audience → share) with our own colors (keep `fb26` tokens, `--primary`, no IG pink/purple).
- Everything wired to existing `useStories.createStory` — no schema changes, no new buckets, no new uuid logic.
- Zero overlay from global chrome on `/create/story` and `/create/reel`.

## Plan

### 1. Hide global chrome on creator routes
- In `src/components/nav/RightSlidePanel.tsx`: read `useLocation()`, return `null` when `pathname.startsWith('/create/')` (also `/create/reel`, `/create/page`).
- In `src/components/Navigation.tsx`: same guard — don't render the top bar on `/create/*`.
- In `src/components/BottomNavigation.tsx`: same guard (it already hides on some routes, extend list).
- Result: `/create/story` becomes a true full-screen editor.

### 2. Consolidate to one editor file
- Keep the routed `src/pages/CreateStoryPage.tsx` as the single source.
- Pull in the better bits from `src/components/CreateStoryPage.tsx` (unified toolbar, crop, adjustments, drawing, stickers, audience all rendered inside one preview).
- Leave `src/components/CreateStoryPage.tsx` on disk untouched per project rules (not deleted, just unused — already unrouted today).

### 3. New IG-style layout inside the routed page
```text
┌──────────────────────────────┐
│ ✕   Story         Audience▾  │  top bar (translucent, over canvas)
├──────────────────────────────┤
│                              │
│      9:16 preview canvas     │  rounded-2xl, object-cover
│   (text/stickers/draw live   │
│    on top of media + filter) │
│                              │
├──────────────────────────────┤
│  [Filters carousel — IG-like]│  thumb = same image w/ filter css
├──────────────────────────────┤
│  Aa  ✏️  😊  ⤴   📐  ✨   │  bottom tool dock (Text/Draw/Stickers/Crop/Adjust/Effects)
├──────────────────────────────┤
│   Text  •  Photo  •  Video   │  source switcher (only when empty)
└──────────────────────────────┘
                                ┌──────┐
                                │Share→│  primary CTA pill, bottom-right
                                └──────┘
```
- Tools open as bottom sheets (`fixed bottom-0` slide-up with spring) instead of replacing the canvas, so the user always sees the preview.
- Active-tool indicator (dot under icon), tap-scale feedback (`active:scale-95 transition-transform`).
- Filters strip: render mini 56×72 thumbnails using the actual `mediaPreview` with `style={{filter: f.css}}` so previews are real, not blank.
- Text/stickers become draggable on the canvas (simple pointer-move with % coords stored on the overlay; already partially in `StoryStickers`/`StoryTextOverlay` — wire `onDragEnd` back to state).
- "Adjust" sheet uses existing `StoryAdjustments`. "Crop" uses existing `StoryCropTool` but rendered as a full-screen sheet from the same page.
- Text-only story: gradient picker stays, but typing happens directly on the canvas (centered textarea), with a quick-style row at the bottom.

### 4. Styling
- All chrome uses `bg-black/40 backdrop-blur-md` pills, `text-white`, `rounded-full`.
- Active accents use `--primary` (our blue), not IG's gradient — keeps brand consistency per the constraint.
- Spring motion via existing `--fb-spring` / `--fb-glide` tokens for sheet transitions and button feedback.

### 5. Share flow
- Single `handlePost` already uses `createStory(content?, mediaFile?)` from `useStories` — keep as is.
- Compose final image: if there are text overlays, stickers, drawing, filters, or adjustments on an **image**, render the preview to a canvas (html2canvas-free approach: draw image + apply filter via `ctx.filter` + draw overlays at the stored % positions) before upload. For video, upload the original file (filters/overlays preview-only this pass — note in TODO comment, no behavior regression vs today).
- Audience selection is captured but not yet persisted (no schema change) — leave existing behavior intact.

### 6. Verify
- Build passes, no TS errors.
- Visit `/create/story` on mobile viewport: no top nav, no right-side FAB.
- Pick an image → filters carousel shows live thumbnails → tap one, canvas updates → add text, drag it → tap Share → story appears in feed Stories rail via existing realtime subscription.

## Files touched
- `src/pages/CreateStoryPage.tsx` — rewritten layout (single canvas + bottom-sheet tools + live filter strip + draggable overlays + canvas-composite share for images).
- `src/components/nav/RightSlidePanel.tsx` — hide on `/create/*`.
- `src/components/Navigation.tsx` — hide on `/create/*`.
- `src/components/BottomNavigation.tsx` — extend hidden-route list with `/create/*`.

## Untouched
- `useStories.ts`, Supabase tables, `stories` bucket, RLS, edge functions, auth, routes, UUIDs, every other page, `src/components/CreateStoryPage.tsx`, all sub-tools (`StoryFilters`, `StoryStickers`, `StoryAdjustments`, `StoryCropTool`, `StoryDrawing`, `StoryTextOverlay`, `StoryAudienceSelector`).

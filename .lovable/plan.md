## Scope

Six fixes, all UI/presentation only. No schema, no auth, no routing, no API changes. Existing hooks (`useThreadedComments`, `useStories`, `useChats`, `useMessages`) reused as-is.

---

## 1. Themes — restore old 5 + add new default, kill rainbow

**Problem:** iOS 26 motion layer overrode `data-color-theme` tokens; "Default" in Settings shows stray pink/rainbow gradients leaking from the motion background.

**Fix:**
- `src/index.css` — locate the rainbow/aurora gradient (likely a `body::before` or `.ios26-bg` rule) and gate it behind `[data-motion="aurora"]`. Default body bg stays solid `hsl(var(--background))`.
- Keep the 5 existing presets (`deep-teal`, `lemon-yellow`, `seamist`, `curious-blue`, `mulled-wine`) in `data-color-theme` blocks — re-verify each still defines `--primary`, `--accent`, `--background` after the iOS 26 additions.
- Add a 6th preset `fb-twitter` (clean white/zinc + Facebook blue `#1877F2` primary) and make it the value written when no `colorTheme` is stored.
- `src/pages/SettingsPage.tsx` — theme picker shows 6 swatches: Default (fb-twitter), Deep Teal, Lemon, Seamist, Curious Blue, Mulled Wine. Each swatch renders its real `--primary` hex, not a random gradient.
- `src/hooks/useTheme.ts` — initial `colorTheme` resolves to `'fb-twitter'` instead of `null` on first load; persistence already fixed last pass, keep as is.

---

## 2. Device back-navigation + haptic vibration

**Fix:**
- New `src/hooks/useDeviceNavigation.ts`:
  - Listens to `popstate` so Android hardware back / browser back closes the topmost open overlay (long-press popup, image viewer, chat sheet, story viewer) before leaving the route. Overlays register via a tiny context (`OverlayStackContext`).
  - Listens to iOS swipe-back via existing browser history (no extra code needed once overlays push synthetic history entries).
- New `src/lib/haptics.ts`:
  - `haptic(type: 'light' | 'medium' | 'heavy' | 'success')` → calls `navigator.vibrate([10])` / `[18]` / `[28]` / `[10,40,10]` when supported; no-op otherwise.
  - Wired into: long-press start, reaction pick, send message, pull-to-refresh trigger, story capture. Pure additive.
- `src/App.tsx` mounts the overlay stack provider once.

---

## 3. Long-press post popup — outside tap should ONLY dismiss popup

**Problem:** Tapping the dimmed area behind the long-press action sheet currently bubbles into the underlying post (opens thread / triggers like).

**Fix:**
- Locate the long-press sheet (likely `MessageLongPressActions.tsx` pattern adapted for posts, or inside `PostCardModern`). Wrap the backdrop in a `<div onPointerDown={(e)=>{e.stopPropagation(); e.preventDefault(); close();}} className="fixed inset-0 z-[80] touch-manipulation">`.
- Sheet body uses `onPointerDown={(e)=>e.stopPropagation()}` so taps inside don't close.
- Matches the project memory rule: "Popups/modals must have secure close buttons and tap-outside dismissal (`touch-manipulation`)."

---

## 4. Threaded comments in the feed

**Problem:** Feed currently uses `CommentsSection` (flat). `ThreadedCommentsSection` + `useThreadedComments` already exist and work (used in ThreadView).

**Fix:**
- `src/pages/Feed.tsx` and any inline comment area on `PostCardModern` — swap `<CommentsSection postId={...} />` for `<ThreadedCommentsSection postId={...} />`. No hook or schema changes; reply UI, like-on-comment, and collapse already built in.
- `ThreadView.tsx` — same swap so the dedicated post page uses threading too.
- `CommentsSection.tsx` stays in the repo (per project rule "never remove existing files") but becomes unused by feed surfaces.

---

## 5. Premium immersive Image Viewer (prompt 1)

**File:** rewrite `src/components/ImageGalleryViewer.tsx` (and update `ProfileImageViewer.tsx` to match shell). Keep all existing props/callers.

- Backdrop: `bg-black/85 backdrop-blur-lg` instead of solid black.
- Remove the top toolbar (zoom in/out/download buttons).
- Floating header overlay:
  - Left: white `←` (or `×`) close button, `bg-black/30 backdrop-blur rounded-full p-2`.
  - Right: white `⋮` button opening a small floating menu (`DropdownMenu`) with: Save to Device, Share Media, View Original Post, separator, Report Content (red).
- Image: centered, `object-contain`, full viewport.
- Bottom caption gradient: `bg-gradient-to-t from-black/80 via-black/30 to-transparent`, shows `@handle` bold + caption underneath in white.
- Gestures: pinch-to-zoom + double-tap-to-zoom (use existing transform state, add `touch-action: none` and a small pointer-events handler — no new library).
- Swipe left/right between multiple images with spring transition (prompt 3 carry-over) using CSS transforms.

---

## 6. Chat info bottom-sheet overhaul (prompt 2)

**File:** `src/components/messaging/ChatSettingsDialog.tsx` (and the trigger from `ChatHeader.tsx` 3-dot menu).

- Convert to a true bottom sheet: `fixed inset-x-0 bottom-0 rounded-t-3xl bg-background/95 backdrop-blur-xl`, spring-in via existing `.fb-sheet-in`.
- Remove from this sheet (move references to a future profile/info view, do NOT delete the components): Search in Chat, Starred Messages, Shared Links, Change Theme, Change Wallpaper, Disappearing Messages.
- Render exactly in order: View Profile, Add Nickname, View Shared Media, Mute Chat, AI Summary (Premium — purple sparkle icon + subtle gradient), separator, Delete / Block Chat (red danger zone).
- Each row: `icon + label`, `h-14 px-5`, tap target full-width.

---

## 7. In-chat image bubbles + chat-list snippet (prompt 3)

**Chat list snippet** — `src/components/messaging/ChatListItem.tsx`:
- Replace any `"📷 Photo"` / emoji preview with plain `"Image"` or `"Video"` in `font-medium text-zinc-400 dark:text-zinc-500`.

**In-chat image bubble** — `src/components/MessageBubble.tsx` (and `EnhancedMessageBubble.tsx`):
- When message is image-only (no text), drop the bubble background/border/padding.
- Image element: `max-w-[300px] rounded-3xl object-cover` + click opens the new ImageGalleryViewer.
- Overlay timestamp + read ticks bottom-right inside the image:
  ```
  <div className="absolute bottom-1.5 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-l from-black/60 to-transparent text-white text-[11px]">
    11:29 am ✓✓
  </div>
  ```

---

## Files to touch

- `src/index.css` — gate rainbow bg, add `fb-twitter` token block
- `src/hooks/useTheme.ts` — default to `fb-twitter`
- `src/pages/SettingsPage.tsx` — 6-swatch picker, real preview colors
- `src/hooks/useDeviceNavigation.ts` (new), `src/lib/haptics.ts` (new), `src/App.tsx` (mount provider)
- Long-press popup component (post action sheet) — backdrop pointer handler
- `src/pages/Feed.tsx`, `src/components/PostCard/PostCardModern.tsx`, `src/pages/ThreadView.tsx` — swap to `ThreadedCommentsSection`
- `src/components/ImageGalleryViewer.tsx`, `src/components/ProfileImageViewer.tsx` — premium viewer rewrite
- `src/components/messaging/ChatSettingsDialog.tsx`, `src/components/messaging/ChatHeader.tsx` — bottom sheet + trimmed rows
- `src/components/messaging/ChatListItem.tsx` — preview snippet
- `src/components/MessageBubble.tsx`, `src/components/EnhancedMessageBubble.tsx` — bubble-less image + overlay timestamp

## Explicitly untouched

Supabase schema, RLS, edge functions, auth/OTP, routing, UUIDs, `useThreadedComments`/`useStories`/`useChats`/`useMessages` hook internals, deprecated polls system, removed components (`CommentsSection` stays in repo unused).

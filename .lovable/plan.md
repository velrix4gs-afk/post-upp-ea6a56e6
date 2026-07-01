# Plan — 3 fixes

## 1. Feed tabs show wrong content
**File:** `src/hooks/useFeed.ts`

Current bug: "For You" filters to friends+self+followed pages (so it looks nearly empty / only shows own posts if no friends). "Following" filters to followed users/pages. Result feels like feed only shows owner posts.

**Fix — align with requested semantics:**
- **For You** (`for-you`): random/discovery mix. Drop friend/page restriction. Query recent public posts globally, ordered by `created_at desc`, then lightly shuffle each page in-memory so the mix feels random. Include posts from followed users/pages naturally (no filter, they'll appear).
- **Following** (`following`): only posts from users the current user follows + pages they follow. Keep existing OR filter, but if both lists are empty show empty state instead of silently returning zero.
- **Trending** stays handled by `TrendingFeed`.

No schema changes. No touching realtime subscription, cache, or pagination logic.

## 2. Chat wallpaper not persisting locally
**Files:** `src/hooks/useChatSettings.ts`, `src/components/messaging/WallpaperDialog.tsx`, wherever wallpaper is read for rendering the chat background (search `wallpaper_url` in chat view).

Current: wallpaper only lives in Supabase `chat_settings.wallpaper_url`, so on chat open there's a flash / it doesn't appear until network settles.

**Fix — device cache layer (per-chat), using existing `AsyncStorage` (`src/lib/asyncStorage.ts`) per project rules:**
- Cache key: `chat_wallpaper:${chatId}` → `{ url, updated_at }`.
- In `useChatSettings`: on mount, synchronously read cached wallpaper and seed `settings.wallpaper_url` immediately so background renders instantly. After the Supabase fetch resolves, if server value differs, update state AND overwrite cache.
- In `setWallpaper` (and the custom upload path in `WallpaperDialog`): write to AsyncStorage cache before/at the same time as the Supabase update — so next open pulls it up instantly.
- No changes to server schema, RLS, or upload logic.

## 3. Feed image viewer too small / images cropped
**File:** `src/components/PostCard/PostCardModern.tsx` (line ~482)

Current: `<img ... className="w-full h-auto object-cover max-h-[250px]" />` — clips tall images.

**Fix:** match how video renders (full natural aspect, no crop):
- Remove `max-h-[250px]` and switch to `object-contain` on a background wrapper so image displays fully without cutoff, e.g. `className="w-full h-auto object-contain bg-black"` inside the existing rounded-xl overflow-hidden wrapper.
- Carousel case (multiple images): apply the same — remove max-height cap, use `object-contain` with a subtle dark background so portrait + landscape both show fully like reels/videos do.
- No changes to click-to-open gallery behavior.

## Files touched
- `src/hooks/useFeed.ts` — feed query logic per tab
- `src/hooks/useChatSettings.ts` — read/write local wallpaper cache
- `src/components/messaging/WallpaperDialog.tsx` — write to cache on set/upload
- `src/components/PostCard/PostCardModern.tsx` — image sizing only

## Out of scope
No schema changes. No auth/routing changes. No touching realtime, notifications, or UUIDs. No removing components or classes elsewhere.

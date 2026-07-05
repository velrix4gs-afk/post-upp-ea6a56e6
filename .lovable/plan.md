# Fix pack: follow state, DM from profile, feed refresh, chat action popup

## CHANGE PLAN

### 1. Follow shows "Follow" again + APP_001 on re-follow
**Files:** `src/hooks/useFollowers.ts`, `src/components/ProfileHeader.tsx`, `src/pages/SearchPage.tsx` (whichever reads follow state on search results)

- Root cause: after `follow()` succeeds we don't refetch/refresh the `is_following` flag consistently, so the button stays on "Follow". A second click re-inserts into `followers` and hits the unique constraint → surfaces as APP_001.
- Fix:
  - In `useFollowers` `follow()`: use `.upsert({...}, { onConflict: 'follower_id,following_id', ignoreDuplicates: true })` instead of plain insert, so a duplicate is a no-op instead of an error.
  - After success, optimistically set local `isFollowing = true` and invalidate/refetch the target profile's followers list so ProfileHeader + SearchPage both flip to "Following".
  - Same treatment for `unfollow()` (delete with `.eq` — already idempotent, just make sure state flips).
- Untouched: DB schema, RLS, notifications side-effects.

### 2. Message button from another user's profile
**Files:** `src/components/ProfileHeader.tsx` (or `ProfilePage.tsx` action bar)

- Currently the Message button either isn't wired or opens the wrong route. Restore prior behavior: on click, call the existing `find_private_chat` RPC (per messaging-architecture memory) with `(auth.uid(), profileUserId)`; if it returns a chat id navigate to `/messages?chat=<id>`, else call the existing "create chat" path in `useChats` then navigate.
- No new logic, no new RPC — reuse what `NewChatDialog` already does.

### 3. Feed pull-to-refresh triggers full DB reload / flicker
**Files:** `src/pages/Feed.tsx`, `src/components/PullToRefresh.tsx`, `src/hooks/useFeed.ts`

- Root cause: scroll-up currently calls `refetch()` which clears the posts array and shows the skeleton for 1–2s. Realtime already keeps the feed fresh, so a manual reload is redundant.
- Fix (smallest change):
  - In `Feed.tsx` `onRefresh` handler: instead of `setPosts([])` + refetch, call a new `refreshSilently()` that fetches page 1 into a temp array and merges with existing state (dedupe by id), without toggling `loading`.
  - Keep the pull-to-refresh spinner tied only to the PullToRefresh component's own state, not to `useFeed.loading`.
  - Realtime `INSERT` subscription (RealtimeFeed) stays as-is — it already prepends new posts.
- Untouched: pagination, realtime channels, post rendering.

### 4. Chat long-press popup (Telegram/WhatsApp iOS style)
**Files:** `src/components/messaging/ChatListItem.tsx`, new `src/components/messaging/ChatLongPressPopup.tsx`

Reference image shows: chat list item stays visible at top, rest of screen blurred/dimmed, floating rounded card of actions (Mark as unread, Pin, Mute/Unmute, Delete) anchored near the pressed row.

- Build a single centered popup (works Android + iOS) using existing Radix `Dialog`:
  - Overlay: `backdrop-blur-xl bg-background/40`, tap-outside to dismiss (per popup-interaction memory).
  - Content: rounded-2xl card, max-w-xs, centered; list of action rows with icon + label matching the reference (Mark as unread/read, Pin/Unpin, Mute/Unmute, Delete in destructive red).
  - Wire actions to existing `useChats` methods (`togglePin`, `toggleMute`, `markUnread`, `deleteChat`) — no new backend.
- Hook up in `ChatListItem` via existing `useLongPress` (500ms) + haptic. Right-click on desktop opens same popup.
- Do NOT touch message-bubble long-press (`LongPressMenu.tsx`) — that's a separate surface.

## TECHNICAL DETAILS

- `useFollowers.follow` upsert signature:
  ```ts
  supabase.from('followers').upsert(
    { follower_id: user.id, following_id: targetId },
    { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
  )
  ```
- Feed silent refresh: keep `posts` state, replace only entries whose `id` matches new page-1 rows, prepend truly new ones. No `setLoading(true)`.
- Chat popup uses semantic tokens only (`bg-card`, `text-foreground`, `text-destructive`) — no hardcoded colors.

## REGRESSION CHECK
- Auth, routing, RLS: untouched.
- Existing message long-press, chat settings sheet, notifications, likes, verification: untouched.
- `useChats`, `useFeed` public APIs unchanged; only additive method / internal behavior.
- No DB schema or edge function changes.

## NOT TOUCHED
- Voice notes, video player, themes, safe-area, iOS zoom (already handled last turn).
- BottomNavigation, PostCard duplicates, comments UI (separate scope).

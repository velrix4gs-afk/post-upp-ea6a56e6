## Scope

Six fixes/features. Reuses every existing hook, table and edge function. No schema changes for items 1–4 and 6. Item 5 only touches the existing `pages` table flow (already in repo) — no new tables unless audit finds a missing column.

---

## 1. iOS "Hold to Peek" chat preview

**Where:** `src/components/messaging/ChatListItem.tsx` + new `src/components/messaging/ChatPeekOverlay.tsx`.

- Add a `usePress` long-press handler (~400ms, pointer-based, cancels on move >8px) on each row. Fires `haptic('medium')` from `src/lib/haptics.ts`.
- On trigger, render a portal overlay:
  - Backdrop `fixed inset-0 z-[90] backdrop-blur-md bg-black/30` with `onPointerDown={close}` and `touch-manipulation` (per project memory rule).
  - Floating window `mx-auto w-[340px] max-w-[90%] rounded-3xl shadow-2xl bg-background overflow-hidden` with spring `scale-95 → 1 + opacity` (CSS keyframe).
  - Body = scroll-locked snapshot of the last ~20 messages for that chat — reuse `useMessages(chatId)` in a child component so the live data is shared, no new fetch path.
  - Header strip = avatar + name (from existing `ChatListItem` props).
- Sheet body `onPointerDown` stops propagation so taps inside don't close.
- Tap outside scales back down to 0.95 + fades, then unmounts.
- No navigation, no DB write. Pure presentation.

---

## 2. GetStream Video calling

**Secret required first.** Need `VITE_STREAM_API_KEY` (publishable, frontend) and `STREAM_API_SECRET` (edge-function only). I'll request both before code lands.

**Edge function (new):** `supabase/functions/stream-token/index.ts`
- POST `{ user_id }` → returns `{ token }` signed with `STREAM_API_SECRET` using `jsr:@stream-io/node-sdk` (or HMAC fallback). JWT verified via existing pattern, Zod-validated.

**Client:**
- `bun add @stream-io/video-react-sdk`.
- New `src/lib/streamClient.ts` — lazy singleton `StreamVideoClient` keyed by current `auth.user.id`, fetches token from the edge function.
- `src/App.tsx` — wrap routes in `<StreamVideo client={...}>` only after auth resolves (skip when signed out, so SDK never inits unauthenticated).
- `src/components/VoiceCall.tsx` & `src/components/VideoCall.tsx` — replace the placeholder timer with `client.call('default', callId).getOrCreate()` + `<StreamCall>` + `<SpeakerLayout>`/audio-only layout. Keep existing prop signature so `IncomingCallOverlay` and chat header call buttons keep working.
- `src/hooks/useCallNotifications.ts` — already exists; extend it to also listen to Stream's `call.ring` event for incoming-call UI activation. Existing `IncomingCallOverlay` stays the visual layer.

Untouched: chat schema, presence, existing call notification rows.

---

## 3. Notifications: realtime delivery + mark-as-read

**Realtime delivery for new messages:**
- DB already has `messages_broadcast_trigger`. Audit `useRealtimeMessages` and `useUnreadMessages` — wire a global subscription in `src/components/RealtimeNotifications.tsx` that on incoming `messages` insert where `sender_id != auth.uid()` and chat not currently open, calls existing `insert into notifications` via the message trigger (verify trigger exists; if missing, add `notify_new_message` trigger in migration — schema-additive only, no table change).
- Bump global unread badge by invalidating `useUnreadMessages` cache on the same event.

**Mark-as-read fix:**
- `src/components/NotificationCenter.tsx` — on open (`useEffect` when panel becomes visible), call `supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false)`. Optimistic local state flip + cache clear so badge clears instantly.
- When user navigates into a chat thread, additionally mark all notifications with `data->>chat_id = currentChatId` as read.
- Add `useNotifications.markAllRead()` if not already present; reuse it.

No new tables. Migration only if the `notify_new_message` trigger is missing.

---

## 4. Story editor — text styles + sticker drawer

**Files:** `src/components/story/StoryTextOverlay.tsx`, `src/components/story/StoryStickers.tsx`, `src/pages/CreateStoryPage.tsx`.

- **Text font picker:** horizontal scroller above the text input with 5 presets — Modern Sans (`font-sans`), Classic Serif (`font-serif`), Bold Neon (`font-black tracking-wider drop-shadow-[0_0_8px_currentColor]`), Elegant Cursive (Google font `Dancing Script` loaded in index.html), Mono (`font-mono`). Each preset stored on the text layer as `fontPreset` string.
- **Pill background toggle:** new boolean `hasBgPill` on the text layer. When on, render text inside `<span class="px-3 py-1 rounded-full bg-black/55 backdrop-blur-sm">` so contrast is guaranteed.
- **Sticker drawer:** floating sticker icon top-right of canvas. Tap opens a `bottom-0 inset-x-0 rounded-t-3xl bg-background/95 backdrop-blur-xl` sheet (~40vh) with three tabs: Emojis (grid of common emojis), Location (uses `navigator.geolocation` → reverse-geocode-free "📍 Current Location" chip), Live Timestamp (`new Date().toLocaleTimeString()` chip, auto-frozen on stamp).
- Tapping any item pushes a new draggable layer onto the existing `stickers` array — reuses existing drag/scale logic.

No DB or storage changes.

---

## 5. Facebook-style Pages — verify + polish

Pages table already exists with `owner_id`, `page_name`, `handle`, `category`, `bio`, `profile_avatar`, `cover_banner`, and posting context. Verify in audit; only migrate if a field is missing.

- **`/pages/create`** (existing `CreatePagePage.tsx`) — convert to true 3-step wizard with progress dots:
  1. Page Name + Category (`Brand`, `Community`, `Entertainment`, `Digital Creator`, `Business`, `Other`).
  2. Handle with live availability check (`supabase.from('pages').select('id').eq('handle', value).maybeSingle()` debounced 400ms, green/red indicator).
  3. Avatar + cover upload (existing `avatars`/`covers` storage buckets, or `posts` if pages bucket missing) + bio.
- Posting context switcher in `CreatePost.tsx`/`FixedPostBar.tsx` — dropdown to post as User or one of the user's owned pages. When a page is selected, `posts.page_id` is set instead of `user_id` (or alongside, depending on existing schema). Verify with audit before coding.
- `PageProfilePage.tsx` — already exists; just make sure the feed query joins on `page_id`.

---

## 6. Follow / unfollow crash fix

**File:** `src/hooks/useFollowers.ts` (`followUser` / `unfollowUser`).

- Wrap full body in `try/catch`. Catch Supabase unique-violation (`23505`) silently and treat as "already following".
- Use atomic pattern:
  ```
  const { error } = await supabase
    .from('followers')
    .upsert({ follower_id: uid, following_id: targetId, status: isPrivate ? 'pending' : 'accepted' },
            { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
  ```
- Unfollow uses a single `.delete().eq(...).eq(...)` with caught errors.
- Optimistic UI: flip local `isFollowing` state and button label immediately. On error → revert + `toast.destructive`, no throw.
- Wrap the consuming button (`FollowersDialog`, `ProfileHeader`, `MutualFollowers`, `FriendSuggestions`) in `ErrorBoundary` so any unexpected throw doesn't unmount the parent.

---

## Files touched (no deletions)

New: `src/components/messaging/ChatPeekOverlay.tsx`, `src/lib/streamClient.ts`, `supabase/functions/stream-token/index.ts`.

Edited: `ChatListItem.tsx`, `App.tsx`, `VoiceCall.tsx`, `VideoCall.tsx`, `useCallNotifications.ts`, `RealtimeNotifications.tsx`, `NotificationCenter.tsx`, `useNotifications.ts`, `StoryTextOverlay.tsx`, `StoryStickers.tsx`, `CreateStoryPage.tsx`, `CreatePagePage.tsx`, `CreatePost.tsx`/`FixedPostBar.tsx`, `useFollowers.ts`, follow-button consumers.

## Explicitly untouched

Auth/OTP, routing, UUIDs, deprecated polls, existing chat schema, RLS unless audit forces a single trigger addition for new-message notifications.

## Order of execution

1. Secrets request (GetStream keys) — blocks item 2 only.
2. Quick audit of `pages` table + `notifications` mark-read column to confirm no migration needed.
3. Implement items 1, 3, 4, 5, 6 in parallel-friendly batches.
4. Item 2 after secrets land.

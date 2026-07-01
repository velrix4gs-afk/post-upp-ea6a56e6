## Fixes

### 1. Opening a chat jumps to a random message
**Where:** `src/components/MessagingSystem.tsx` (`scrollToBottom` runs on every render / prop change, and highlight-scroll to arbitrary messages can win the race).
**Fix:** On chat open, always scroll `messagesEndRef` into view after the first message batch loads (single effect keyed on `chatId` + `messages.length > 0`). Only jump to a specific message when the user explicitly clicked a search/pin/reply reference. Use `behavior: 'auto'` for the initial jump so it lands instantly on the newest message.

### 2. Theme color only applies to half the app
**Where:** `src/hooks/useTheme.ts`, `src/hooks/useAppearanceSync.ts`, `src/index.css`.
**Fix:** Restore the previous theme application path (write CSS vars on `document.documentElement` on load + on any settings change) so every route inherits the token, while keeping the current visual palette / new component looks intact. No component redesigns — just the theme propagation restored.

### 3. Voice notes can't send + no waveform animation
**Where:** `src/components/VoiceRecorder.tsx`, `src/components/messaging/ChatInput.tsx`, `src/hooks/useMessages.ts`.
**Fix:**
- Wire `VoiceRecorder`'s `onSend(blob)` in `ChatInput` to upload to the existing `messages` storage bucket and insert a `messages` row with `media_url` + `message_type='voice'` via the current send-message path (no new API).
- Add a real waveform: sample `AnalyserNode.getByteFrequencyData` from the `MediaRecorder`'s stream and render animated bars (CSS transform scaleY driven by rAF) while recording; fall back to a pulsing dot if AudioContext is unavailable.

### 4. Following a user doesn't reflect on profile
**Where:** `src/hooks/useFollowers.ts`, `src/pages/ProfilePage.tsx`.
**Fix:** After `followUser` / `unfollowUser` resolves, invalidate/refetch the current profile's `isFollowing` and counts (optimistic flip + confirm). Ensure the Follow button reads from the same state used by the "Following" list so both stay in sync.

### 5. Messaging a user from their profile crashes
**Root cause:** `supabase.rpc('create_private_chat', ...)` returns a row set `{ chat_id, target_user }`, not a scalar. `ProfilePage.handleMessage` navigates to `/messages?chat=${data}` where `data` is an array/object → route breaks → crash.
**Fix in `src/pages/ProfilePage.tsx`:**
- First call `supabase.rpc('find_private_chat', { p_user_a, p_user_b })` (already exists) to reuse existing DM.
- If null, call `create_private_chat`, then read `data?.[0]?.chat_id`.
- Guard against missing id before `navigate`; toast a clean error if it fails.
- Same guard on `MiniProfilePopup.handleMessage`.

### 6a. Feed auto-refresh when scrolling to bottom
**Where:** `src/pages/Feed.tsx` + `src/hooks/usePullToRefresh.ts`.
**Fix:** Pull-to-refresh must only trigger from the top of the scroll container (already the intent) — add a `scrollTop <= 0` gate before starting a pull, so hitting the bottom / rubber-band on iOS can't fire it. Keep real-time updates as the only automatic loader; new pages load via the existing infinite-scroll observer, not a refetch loop.

### 6b. Repeated error-toast spam
**Where:** `src/hooks/useFriends.ts` (console shows `[FRIEND_001] Failed to load friendships` looping through the `friendships` edge function), plus global `src/lib/errorHandler.ts` / `src/lib/networkErrorHandler.ts`.
**Fix:**
- Switch `useFriends` off the failing edge function to the direct `friendships` table query it can do under RLS, matching how `useFollowers` already works. Silently return `[]` when offline; no toast.
- Dedupe toasts by error code in `errorHandler.ts` (already partially in place) — extend the suppression window and drop any repeated "Failed to load …" errors during offline / retry loops.

## Out of scope
No schema changes. No auth/routing/UUID changes. No visual redesign — only theme propagation restored and waveform added.

## Files touched
`src/components/MessagingSystem.tsx`, `src/hooks/useTheme.ts`, `src/hooks/useAppearanceSync.ts`, `src/index.css`, `src/components/VoiceRecorder.tsx`, `src/components/messaging/ChatInput.tsx`, `src/hooks/useMessages.ts`, `src/hooks/useFollowers.ts`, `src/pages/ProfilePage.tsx`, `src/components/MiniProfilePopup.tsx`, `src/pages/Feed.tsx`, `src/hooks/usePullToRefresh.ts`, `src/hooks/useFriends.ts`, `src/lib/errorHandler.ts`.
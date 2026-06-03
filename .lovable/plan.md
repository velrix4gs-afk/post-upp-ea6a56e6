## Plan

### 1. GetStream calling integration

- Store `STREAM_API_SECRET` as backend secret; add `VITE_STREAM_API_KEY = byeg282tjdhu` to `.env` (public, frontend safe).
- New edge function `stream-token` → validates JWT via `getClaims`, signs Stream user token using HMAC-SHA256 with secret, returns `{ token }`.
- New `src/lib/streamClient.ts` singleton: `StreamVideoClient` initialized with user from `useAuth`, token fetched from edge function (cached).
- Wrap authenticated routes in `App.tsx` with `<StreamVideo client={…}>`.
- Replace internals of `VoiceCall.tsx` / `VideoCall.tsx` with `client.call('default', chatId).join({ create: true })` + `<StreamCall>` + `<SpeakerLayout>` / audio-only layout. Keep existing component props/exports so callers don't break.
- Extend `useCallNotifications.ts` to listen to `call.ring` events from Stream and surface in existing `IncomingCallOverlay.tsx` (props unchanged).
- Keep existing `call_signals` table & WebRTC code untouched as fallback for now (no DB changes).

### 2. iOS-style chat peek (refinement)

Update `ChatPreviewModal.tsx`:

- Backdrop becomes `bg-background/40 backdrop-blur-2xl saturate-150` (iOS frosted look).
- Card: `rounded-[28px]`, subtle border `border-white/10`, layered shadow, spring scale from 0.92.
- Header: large avatar + name + small "Preview" pill; tap header → open chat.
- Messages: bubble radius `rounded-[22px]`, tighter spacing, iOS blue for own bubbles via theme token.
- Bottom action row: "Open chat", "Mute", "Mark as read" pill buttons (mute/mark wired to existing hooks; mark-as-read OPT-IN, doesn't auto-mark on peek per memory).
- Tap-outside dismiss preserved; haptic on open.
- preview should look exactly like the chat with the image showing and all 
- in chat message bubble for image should rival that of whatsapp

### 3. Coins page + Tipping verified users

- New route `/coins` → `CoinsPage.tsx`: balance from existing `useCoins`/profile, packages grid (reuse `CoinsDialog` logic), purchase via existing `create-coins-checkout` edge function, history list from `usePurchaseHistory`.
- Tipping: extend `TipDialog.tsx` to call existing `process-tip` edge function; expose "Tip" button on `ProfileHeader.tsx` and `PostCardModern.tsx` ONLY when target profile `is_verified = true`.
- No schema changes — uses existing `coins`, `tips`, and `process-tip` infra.

### 4. Reels page — TikTok rebuild

Rewrite `ReelsPage.tsx`:

- Full-screen vertical snap scroller (`h-[100dvh] snap-y snap-mandatory overflow-y-scroll`).
- Each reel: muted autoplay video, tap = play/pause, double-tap = like (haptic), long-press = pause.
- Right rail: avatar+follow, like, comment, share, more (TikTok layout) — reuse `useReactions`, `useThreadedComments` (comments open as bottom sheet `Drawer`).
- Bottom: `@username`, caption with hashtags, audio strip.
- Top bar: "For You / Following" tabs + **explicit close (X) button** routing back to Feed → fixes "can't get out" bug.
- Bottom nav stays visible on this route (overrides auto-hide while on /reels so user can navigate away).
- IntersectionObserver pauses off-screen videos.

### 5. Story creation fix

Audit `CreateStoryPage.tsx` + `useStories.ts`:

- Fix upload path (`stories` bucket) and `media_type` detection; ensure `expires_at = now()+24h` is set.
- Ensure overlays (text/stickers/drawing) are flattened via canvas before upload OR persisted as JSON metadata column already present.
- Guard: button disabled until media chosen; explicit error toast on failure (currently silently fails per user report).
- Keep existing editor UI; only fix the broken save path.

### 6. Themes — keep changeable

- `useTheme.ts`: restore 5 legacy themes + new FB/Twitter default already added.
- `SettingsPage.tsx` theme picker: ensure all themes selectable, persisted to `user_settings.theme`, applied via `data-theme` on `<html>`.
- Remove any leftover rainbow gradient body background introduced by iOS 26 theme; gate iOS 26 visuals behind its own theme only.

### 7. Secrets / env

- Add `STREAM_API_SECRET` (provided by user) via add_secret.
- Append `VITE_STREAM_API_KEY=byeg282tjdhu` to `.env`.

### Files

**New**: `supabase/functions/stream-token/index.ts`, `src/lib/streamClient.ts`, `src/pages/CoinsPage.tsx`.
**Edited**: `src/App.tsx`, `src/components/VoiceCall.tsx`, `src/components/VideoCall.tsx`, `src/hooks/useCallNotifications.ts`, `src/components/messaging/ChatPreviewModal.tsx`, `src/components/premium/TipDialog.tsx`, `src/components/ProfileHeader.tsx`, `src/components/PostCard/PostCardModern.tsx`, `src/pages/ReelsPage.tsx`, `src/pages/CreateStoryPage.tsx`, `src/hooks/useStories.ts`, `src/hooks/useTheme.ts`, `src/pages/SettingsPage.tsx`, `src/index.css`, `.env`.

### Order

1. Add Stream secret + env → 2. Theme/rainbow fix (quick) → 3. ChatPreviewModal polish → 4. Story creation fix → 5. Coins page + tipping → 6. Reels rebuild → 7. Stream calling (last, depends on secrets + SDK install `@stream-io/video-react-sdk`).

No database migrations required. No existing files removed.
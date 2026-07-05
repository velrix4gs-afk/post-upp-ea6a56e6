## Fixes

### 1. Voice notes fail with error toast

Root cause: `handleVoiceSend` uploads to storage bucket with `contentType: 'video/webm'` (workaround for allowed_mime_types), but then calls `sendMessage(..., 'audio/webm')`. The insert into `public.messages` succeeds, but the URL Supabase serves has header `Content-Type: video/webm`, so the receiving `<audio>` element refuses to load it → the whole flow appears broken. Also, `MediaRecorder.onstop` occasionally fires with `chunksRef.current.length === 0` on iOS Safari because `requestData()` returns asynchronously — the "Recording too short" toast then fires even for real recordings.

Fixes:
- Widen the `messages` storage bucket `allowed_mime_types` (via `supabase--storage_update_bucket`) to include `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/ogg`.
- In `MessagesPage.handleVoiceSend`, upload with the **actual** `audioBlob.type` (`audio/webm;codecs=opus` normalized to `audio/webm`) — no more masquerading as video.
- In `VoiceRecorder.onstop`, await one microtask after `requestData()` before checking chunks, and only toast "Recording too short" when `duration < 1 && chunks empty`.
- Remove destructive error toast on send-fail; log silently and keep recorder open so the user can retry.

### 2. Feed video won't play (play button visible, tap does nothing)

Root cause: in `PostCardModern.handleCardClick` the new guards call `.closest('video'|'audio'|'[data-media]')`, which correctly stop navigation — but the click on the **overlay play button** targets a `<div>` sibling of the `<video>`, not inside it. It's inside the `data-media` wrapper though, so navigation is prevented. However, the wrapper has `onClick={(e) => e.stopPropagation()}` at the div level, which fires **before** the child overlay's `onClick={togglePlay}` in the same bubble — but React uses synthetic events and stopPropagation only stops parent handlers, so togglePlay still runs. The real bug: `videoRef.current.play()` returns a Promise; when the video has `preload="metadata"` (default) on iOS and the source needs a cross-origin range request, the first `play()` throws "NotAllowedError" *silently* (no `.catch`). The play toggle silently fails.

Fix in `src/components/VideoViewer.tsx`:
- Add `preload="auto"` and `crossOrigin="anonymous"` to the `<video>`.
- Wrap `videoRef.current.play()` in `.then/.catch` and on catch, set `muted=true` then retry once (browser autoplay policy allows muted playback).
- Keep the existing `data-media` and `stopPropagation` guards.

### 3. Theme only applies on Profile / post textarea; rest of app is white

Root cause: `useTheme` default is `'system'`. In `index.html` the anti-flash script honors this and sets `light`/`dark` on `<html>`. Once inside the app, `useAppearanceSync` fetches `user_settings.theme_preference` and applies it — but it only mutates `<html>` classes, it never notifies `useTheme`'s state. So components that render before that async sync land on the `light` class. In addition, several page shells (Feed background wrapper, MessagesPage, various hero panels) use raw `bg-white`/`text-black`/hardcoded hex colors instead of `bg-background`/`text-foreground` semantic tokens, so they stay white even when `.dark` is on `<html>`.

Fixes:
- In `src/hooks/useAppearanceSync.ts`, after applying `theme_preference`, dispatch a `storage` event so `useTheme` re-reads, and set the class synchronously **before** first paint via the same anti-flash pattern.
- Sweep the following files for hardcoded color utilities and replace with semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`): `Feed.tsx`, `Dashboard.tsx`, `SearchPage.tsx`, `NotificationCenter.tsx`, `SettingsPage.tsx` (only the shell wrappers, not per-component logic).
- No schema, no new tables — this is purely presentation.

### 4. iOS zoom-in when tapping a text field

Root cause: iOS Safari zooms any input/textarea whose computed font-size is < 16px.

Fixes:
- `src/components/ui/textarea.tsx` and `src/components/ui/input.tsx`: ensure the base class includes `text-base` (16px) on mobile via `text-base md:text-sm` so desktop stays compact and mobile stops zooming.
- Same for `ChatInput.tsx` textarea and the message composer inputs.
- Confirm `<meta name="viewport" content="... maximum-scale=5.0 ...">` in `index.html` is unchanged (already correct — do not set `user-scalable=no`, which harms accessibility).

### 5. Edge-to-edge (fullscreen) whole app on mobile

Root cause: Most page wrappers add `container mx-auto px-4` and `Navigation` sits above them, leaving safe-area gutters unused. `viewport-fit=cover` is already set; what's missing is CSS use of `env(safe-area-inset-*)`.

Fixes in `src/index.css`:
- Add a utility layer that applies `padding-top: env(safe-area-inset-top)` to top nav / status bars and `padding-bottom: env(safe-area-inset-bottom)` to bottom nav / composer.
- On mobile breakpoints (`@media (max-width: 767px)`), reset page containers (`main`, `.container`) to `padding-inline: 0` and let cards handle their own inner padding.
- Add `min-height: 100dvh` to the outermost app shell to remove the white iOS URL-bar gap.
- No component structure changes — only CSS.

## Files touched

- `src/pages/MessagesPage.tsx` — voice upload contentType
- `src/components/VoiceRecorder.tsx` — chunk flush + silent fail
- `src/components/VideoViewer.tsx` — play() error handling + preload
- `src/hooks/useAppearanceSync.ts` — sync theme class before paint
- `src/pages/Feed.tsx`, `Dashboard.tsx`, `SearchPage.tsx`, `NotificationCenter.tsx`, `SettingsPage.tsx` — swap hardcoded colors for semantic tokens (shells only)
- `src/components/ui/textarea.tsx`, `src/components/ui/input.tsx`, `src/components/messaging/ChatInput.tsx` — `text-base md:text-sm`
- `src/index.css` — safe-area utilities + `100dvh` shell
- Storage: widen `messages` bucket allowed mime types to include `audio/*`

## Not touched

- Auth, routing, RLS, DB schema
- Any hook logic beyond appearance sync
- Notifications, likes, verification, premium, calls, breadcrumb popup restore
- `BottomNavigation.tsx`, `PostCard.tsx`, `PostCardModern.tsx` (duplicates kept; both imported)
- Existing theme tokens themselves — only ensuring they're actually applied

## Regression review after implementation

- Sign-in / sign-up still works (no auth changes)
- Chat send text still works (only voice upload path modified)
- Feed images still render (only video branch changed)
- Existing theme toggles (Settings) still work — sync now flows both ways
- Profile page (currently the one working page) remains unchanged
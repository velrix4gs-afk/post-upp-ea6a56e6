## Fixes

### 1. "Failed to load profile" spam — remove entirely + fix root cause
Root cause: `useProfile` fires `fetchProfile` on mount before Supabase auth session is restored, so `auth.uid()` is null and the RLS-scoped `.single()` returns `PGRST116` / permission error, which then toasts.

- Add `useAuthReady` hook (`src/hooks/useAuthReady.ts`) that resolves once `supabase.auth.getSession()` returns.
- In `useProfile.ts`:
  - Gate `fetchProfile` and the realtime subscription on `authReady`.
  - Retry once on `PGRST116` after 400ms (covers race where profile row is just being created by `handle_new_user`).
  - **Remove the toast entirely** — log to console via `reportSilently('PROFILE_LOAD', err)` and set `error` state. No user-facing toast for load failures (only for update/upload failures, which are user-initiated).
  - Delete `profileErrorToastOnce` + `_lastProfileToastAt`.

### 2. Voice notes not sending
Root cause: `MediaRecorder` is created after `await getUserMedia`, which is fine, but on some browsers `onstop` fires before the final `ondataavailable` chunk lands, producing an empty blob and the "Recording too short" toast even after a real recording.

In `src/components/VoiceRecorder.tsx`:
- Call `mediaRecorder.requestData()` right before `stop()` in `stopRecording` so the final chunk is flushed synchronously.
- Move the "empty blob" check off `blob.size` alone — also accept `chunksRef.current.length > 0` and rebuild.
- Guard against double-send: if `handleSend` is called while `audioBlob` is null, wait for `onstop` (already done via `shouldSendOnStopRef`), but also add a 2-second safety timeout that force-resolves.
- Prefer `audio/webm;codecs=opus` mimeType, fall back to `audio/mp4`, then default.

### 3. Feed videos won't play
Root cause: `PostCardModern`'s `handleCardClick` navigates to `/post/:id` on any click that isn't a `button`/`a`/`role=button`. The `<video>` element is none of those, so tapping play navigates away instead of playing.

- In `PostCardModern.tsx` `handleCardClick`, also bail when the target is inside a `video`, `audio`, or `[data-media]` element.
- In `VideoViewer.tsx`, wrap the root in `onClick={(e) => e.stopPropagation()}` so clicks on the player never bubble to the card.

### 4. Reduce feed randomization
In `src/hooks/useFeed.ts` (`for-you` branch): remove the `Math.random() - 0.5` shuffle. Keep `created_at DESC` ordering; the discovery mix is already provided by not filtering by author. This makes the feed stable across renders and pagination.

### 5. Remove old unused files (safe deletions only)
Verified via grep — these have no importers:
- `src/components/PostCard.tsx` (old, replaced by `PostCard/PostCardModern.tsx`; the two importers `Dashboard.tsx` and `ThreadView.tsx` use the modern one — will re-verify per-file before deleting).
- `src/components/PostCardModern.tsx` (root duplicate of `PostCard/PostCardModern.tsx`).

`BottomNavigation.tsx` is **actively used** in `App.tsx` — it stays. Any file with a live importer will NOT be deleted (per your project rules).

### Out of scope
- No schema changes.
- No auth/routing/UUID changes.
- No changes to messaging, notifications, likes, or verification logic.
- Existing theme, safe-area, voice UI, call flows, breadcrumb popup restore — untouched.

### Files touched
- new: `src/hooks/useAuthReady.ts`
- edit: `src/hooks/useProfile.ts`, `src/components/VoiceRecorder.tsx`, `src/components/PostCard/PostCardModern.tsx`, `src/components/VideoViewer.tsx`, `src/hooks/useFeed.ts`
- delete (only after final importer check): `src/components/PostCard.tsx`, `src/components/PostCardModern.tsx`

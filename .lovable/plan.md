## Scope

Three fixes. No changes to auth logic, routing structure, DB schema, messaging/notifications/likes/premium logic. Prior work (theme, voice notes, full-screen safe areas, calls, comment popup, iOS insets) stays intact — this plan only adds/edits code paths listed below.

---

### 1. Post-signup onboarding wizard (verify + finish)

The previous turn added `src/pages/OnboardingPage.tsx` and gated it via `ProtectedRoute` + `EmailVerification`. Verification pending — need to actually confirm the flow works end-to-end and finish gaps.

**Work:**
- Read current `OnboardingPage.tsx` and confirm 3 steps exist: username (live availability via `select id from profiles where username = ?`), display name, avatar upload. Add a 4th step: **interests** (chip multi-select, writes to `profiles.interests` if the column exists; otherwise skip that step — will verify with `supabase--read_query` before coding).
- Username availability: debounce 400ms, show ✓/✗ inline, block "Next" while taken/invalid. Rules: 3–20 chars, `[a-z0-9_]`.
- Avatar step: reuse existing `uploadAvatar` from `useProfile` — do NOT invent a new upload path.
- On finish: `update profiles set username, display_name, avatar_url, [interests], is_profile_complete = true where id = auth.uid()` then `navigate('/feed', { replace: true })`.
- Verify `ProtectedRoute` gate: if `is_profile_complete === false` and route ≠ `/onboarding`, redirect. Keep as-is if already correct.
- Mobile-first layout: full-height, single column, large tap targets, safe-area padding top/bottom (reuse the utilities added last turn).

**Verification before claiming done:** Playwright script — sign in as test user with `is_profile_complete=false`, walk through all steps, screenshot each, confirm final row update via `supabase--read_query`.

---

### 2. Silence friend-load error spam (root-cause the fetch failure)

**Symptom:** repeated "could not load friends" toasts.

**Root cause hypothesis (to verify, not assume):** `useFriends.fetchFriendships` currently swallows errors silently, but other call sites (`sendFriendRequest`, `acceptFriendRequest`, etc.) toast on every failure, and realtime subscriptions re-trigger fetches on every change → if the underlying query 401s or the edge function is down, every retry toasts.

**Work:**
- Investigate first: check console/network for the actual error (401? 500? CORS? RLS on `friendships`?). Run `supabase--read_query` on `friendships` policies + a sample select as anon/authenticated.
- Route all friend toasts through `shouldShowErrorToast` from `src/lib/errorSuppression.ts` (already exists) so network/offline errors don't toast.
- Add a module-level `lastToastAt` guard in `useFriends.ts`: suppress duplicate error toasts within a 10s window (dedupe by message).
- If the real failure is the `friendships` edge function, switch mutations to direct table writes under RLS (matches how `fetchFriendships` was already migrated last turn). Only do this after confirming the edge function is the cause via `supabase--edge_function_logs`.
- Do NOT change friend business logic, state shape, or public API of the hook.

**Verification:** reload feed with devtools throttling to Offline → confirm zero toasts. Back to Online → confirm friends load and at most one toast on genuine failure.

---

### 3. Breadcrumb back-stack (popup → profile → messages → back → back)

**Current gap:** `BackNavigation` calls `navigate(-1)` which works for page-to-page but loses modal/popup state (e.g. `MiniProfilePopup` open on Feed → tap "View profile" → tap "Message" → back should return to Profile with nothing open, back again should return to Feed **with the popup re-opened**).

**Work:**
- Add a lightweight `NavStackContext` (`src/contexts/NavStackContext.tsx`) that records a stack of `{ path, state }` entries on every route change. State includes an optional `openPopup: { type: 'mini-profile', userId }` marker.
- When a popup opens (e.g. `MiniProfilePopup`), it registers itself via `pushOverlay({ type, payload })` — this replaces the current history entry via `navigate(pathname, { replace: true, state: { openPopup: {...} } })`.
- When navigating away (e.g. "Message" button inside the popup), use `navigate('/messages/:id', { state: { from: pathname, overlay: openPopup } })` so the browser back stack naturally restores it.
- On mount, pages check `location.state?.openPopup` and re-open the referenced overlay (MiniProfilePopup listens for `userId`).
- `BackNavigation.handleBack` stays as `navigate(-1)` — the browser history now carries the overlay hints, so back "just works".
- Wire into: `MiniProfilePopup`, `ProfilePreviewCard`, `ProfileHoverCard` (only the ones that navigate to another page from inside the popup). No changes to unrelated dialogs.

**Verification:** Playwright — Feed → open mini-profile → click View profile → click Message → press browser back twice → assert URL is `/feed` AND mini-profile is visible.

---

### Preservation checklist (must remain unchanged)

- iOS safe-area insets in `index.html`, `index.css`, `Navigation.tsx`, `BottomNavigation.tsx`
- Voice recorder 250ms timeslice in `VoiceRecorder.tsx` + wavy animation
- Comment button opens Sheet, not full page (`PostCardModern.tsx`)
- Theme tokens (no hardcoded colors added)
- Call flows, messaging privacy, RLS policies
- Existing `useProfile`, `useFriends`, `ProtectedRoute` public APIs

### Files touched (planned)

- `src/pages/OnboardingPage.tsx` (finish + interests step if column exists)
- `src/hooks/useFriends.ts` (dedupe toasts, route through `shouldShowErrorToast`)
- `src/contexts/NavStackContext.tsx` (new)
- `src/App.tsx` (wrap with provider)
- `src/components/MiniProfilePopup.tsx`, `ProfilePreviewCard.tsx`, `ProfileHoverCard.tsx` (overlay hints)
- No DB migrations unless `interests` column is missing — will confirm first and ask before adding.

### Out of scope

Redesigns, new pages beyond onboarding, auth changes, edge function rewrites unless required by the friend fetch root cause.

STATUS REPORT (post-implementation, to be filled in build mode):
- ✓ Implemented / ✓ Reviewed / ✓ Tested / ✓ Verified — marked only per actually completed items.

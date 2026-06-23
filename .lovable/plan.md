## Goal
Fix the offline error-spam UX and ship a WhatsApp-style mobile call UI for voice + video, without touching auth, routing, schema, or existing business logic.

---

## Part 1 — Silence the offline error spam

**Problem:** When the network drops, every hook (`useFriends`, `useMessages`, stories, posts, reactions, etc.) fires its own `toast.error(...)` / `errorLogger` popup, so the user gets dozens of red toasts instead of one quiet "No internet" indicator.

**Fix (presentation layer only — no business logic changes):**

1. **`src/lib/networkMonitor.ts`** — already the single source of truth for online/offline toasts. Tighten it:
   - One `sonner` toast id (`'net-status'`) that gets `.dismiss()`'d and re-shown so it can never stack.
   - `duration: 1000` for the offline toast, no description, no action.
   - Keep the 3s cooldown but also gate by `document.visibilityState === 'visible'`.

2. **New `src/lib/errorSuppression.ts`** — tiny helper:
   - `isNetworkError(err)` → matches `FunctionsFetchError`, `TypeError: Failed to fetch`, `NetworkError`, `AbortError`, `!navigator.onLine`.
   - `shouldShowErrorToast(err)` → returns `false` when offline or when the error is a network error (the global offline toast already covers it).
   - `reportSilently(code, err)` → still calls `errorLogger` for diagnostics but never toasts.

3. **Wire suppression into the existing error surfaces** (no new logic, just a guard before each toast):
   - `src/lib/errorHandler.ts`, `src/lib/networkErrorHandler.ts`, `src/lib/errorCodes.ts`/`errorCodes.enhanced.ts` — wrap their toast calls in `if (shouldShowErrorToast(err)) { ... }`.
   - Hooks that currently toast on fetch failure get their `toast.error` swapped for `reportSilently`: `useFriends`, `useStories`, `useFeed`, `usePosts`, `useReactions`, `useMessages`, `useComments`, `useNotifications`, `useReels`, `useChats`. Console logging stays so debugging is unaffected.
   - `ErrorBoundary` — keep, but make the fallback render `null` for offline-class errors and let the global toast speak.

4. **`useOfflineSync` / `syncEngine`** — collapse the "Synced N actions" toast to one debounced toast per reconnect (already partially in `networkMonitor`); remove the duplicate in `useOfflineSync`.

Result: offline → exactly one 1-second "No internet" toast. Online → one "Back online" toast (only if there were pending items). All other red popups stay silent while offline.

---

## Part 2 — WhatsApp-style mobile call UI

**Scope:** UI/UX only. Keep Stream SDK as the live transport (`VoiceCall.tsx`, `VideoCall.tsx`, `useStreamVideoClient.ts`). No signaling/business-logic changes.

**New components under `src/components/calls/`:**

- `CallShell.tsx` — full-screen `h-[100dvh]` container, safe-area padding, dark gradient backdrop, blurred avatar background for voice. Handles swipe-down → minimize, back-button → minimize (not end).
- `CallHeader.tsx` — caller name, status (`Ringing… / Connecting… / 00:42`), encryption badge, minimize chevron.
- `CallControlsBar.tsx` — bottom rounded bar with WhatsApp-style large circular buttons:
  - Voice: **Speaker**, **Mute**, **Video** (upgrade), **End**.
  - Video: **Flip camera**, **Camera on/off**, **Mute**, **End**, plus tap-to-hide controls after 3s idle.
- `LocalPiP.tsx` — draggable/snappable local preview (video calls), pinch-to-swap with remote.
- `IncomingCallScreen.tsx` — full-screen incoming UI with swipe-up Accept / swipe-down Decline (WhatsApp pattern), plus tap fallbacks. Replaces the small toast on mobile; keeps `IncomingCallToast` for desktop.
- `MinimizedCallBubble.tsx` — floating pill (avatar + timer + end-button) that persists across routes once the user minimizes a call, tap to restore. Mounted from `App.tsx` via a new lightweight `CallUIProvider`.

**State (new, additive — does not touch existing call hooks):**
- `src/hooks/useCallUI.ts` — Zustand/React context holding `{ minimized, controlsVisible, durationSec }`. Pure UI state. The actual Stream `Call` object stays inside `VoiceCall` / `VideoCall`; we lift only their *render* into `CallShell` so minimize works without leaving the call.

**Integration (minimal edits to existing files):**
- `VoiceCall.tsx` — keep all Stream logic; replace the inner JSX (`<Card>` + control buttons) with `<CallShell kind="voice">…</CallShell>` using `useCallStateHooks` as today. No behavior change.
- `VideoCall.tsx` — same swap: `SpeakerLayout` stays as the remote node, controls move into `CallControlsBar`, local preview into `LocalPiP`.
- `IncomingCallOverlay.tsx` — on mobile (`useIsMobile`) render `IncomingCallScreen`, else current overlay.
- `App.tsx` — mount `<CallUIProvider>` + `<MinimizedCallBubble />` once at root so the bubble survives route changes.

**Design tokens only** — all colors via `bg-background`, `bg-primary`, `text-foreground`, `bg-destructive`, etc. No raw hex. Buttons use existing `Button` variants with new `rounded-full h-14 w-14` sizing.

**Accessibility / mobile polish:**
- `touch-manipulation`, `aria-label` on every control.
- Haptic feedback on accept/decline/end via existing `src/lib/haptics.ts`.
- Auto-hide top/bottom bars after 3s of no touch on video (matches the project's nav rule).
- Wake-lock request during active call (best-effort, feature-detected).

---

## Files

**New**
- `src/lib/errorSuppression.ts`
- `src/hooks/useCallUI.ts`
- `src/components/calls/CallShell.tsx`
- `src/components/calls/CallHeader.tsx`
- `src/components/calls/CallControlsBar.tsx`
- `src/components/calls/LocalPiP.tsx`
- `src/components/calls/IncomingCallScreen.tsx`
- `src/components/calls/MinimizedCallBubble.tsx`
- `src/components/calls/CallUIProvider.tsx`

**Edited (surgical, behavior preserved)**
- `src/lib/networkMonitor.ts` — single-id toast, 1s duration.
- `src/lib/errorHandler.ts`, `src/lib/networkErrorHandler.ts`, `src/lib/errorCodes.ts`, `src/lib/errorCodes.enhanced.ts` — gate toasts via `shouldShowErrorToast`.
- `src/hooks/useOfflineSync.ts` — drop duplicate toast.
- `src/hooks/useFriends.ts`, `useStories.ts`, `useFeed.ts`, `usePosts.ts`, `useReactions.ts`, `useMessages.ts`, `useComments.ts`, `useNotifications.ts`, `useReels.ts`, `useChats.ts` — swap user-facing error toasts for `reportSilently` (console + logger only).
- `src/components/VoiceCall.tsx`, `src/components/VideoCall.tsx` — render through `CallShell`, no Stream logic changes.
- `src/components/IncomingCallOverlay.tsx` — mobile branch to `IncomingCallScreen`.
- `src/App.tsx` — mount `CallUIProvider` + `MinimizedCallBubble`.

**Not touched:** auth, routing, Supabase schema, edge functions, Redis bridge, signaling stubs, UUIDs, existing data flow.

---

## Out of scope (per your rules)
- No new edge functions, no DB migrations, no secrets work.
- No removal/rename of files or props.
- No invented business logic.

---

## Order of work (kept tight to save credits)
1. `errorSuppression.ts` + `networkMonitor.ts` tightening.
2. Patch the 4 error utilities + 10 hooks (one pass, no rewrites).
3. `useCallUI` + `CallShell` + controls + PiP.
4. Wire `VoiceCall` / `VideoCall` / `IncomingCallOverlay` into the shell.
5. `MinimizedCallBubble` + `CallUIProvider` mounted in `App.tsx`.
6. Manual smoke: airplane-mode toggle, start voice call, minimize, navigate, restore, end.

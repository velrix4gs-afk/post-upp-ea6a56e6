# Composer polish + non-blocking errors + iOS status bar

## 1. Stop forcing full screen on iOS
The app currently opts into edge-to-edge display (`viewport-fit=cover` in `index.html` plus web-app status-bar styling), which slides content under the clock/Dynamic Island.

- Remove `viewport-fit=cover` from the viewport meta and drop the `apple-mobile-web-app-status-bar-style: black-translucent` behaviour so iOS keeps its normal status bar with visible time/battery.
- Keep the existing `.safe-*` CSS helpers in place (they become no-ops / small insets) so no layout collapses. Only the top inset behaviour changes; bottom nav and call screens keep their padding.
- Untouched: Android layout, call overlay, story editor chrome.

## 2. Non-intrusive connection error toasts
Replace blocking/angry error popups for network failures with one sleek floating bottom toast with a single-tap Retry.

- Add a small helper (e.g. `src/lib/connectionToast.ts`) that shows a single deduped bottom-centred sonner toast: "Connection lost" + inline **Retry** action button, auto-dismiss, never stacking (fixed toast id).
- Wire the offline/online listeners in `networkMonitor.ts` to this toast instead of the plain "No internet" text toast; Retry re-runs the caller-provided action (or a soft refetch when none is given).
- Keep the existing suppression/dedupe guards (`errorSuppression.ts`, `toastGuard.ts`) exactly as-is so error spam stays suppressed.

## 3. Ghost drafting (auto-restore composer text)
- Add `useGhostDraft(key)` hook backed by localStorage: debounced save of composer text (and selected privacy) on change, clear on successful publish.
- Apply to the real composers in use: `feed/CreatePostCard.tsx`, `CreatePost.tsx`, `CreatePostSimple.tsx`.
- On mount, if a stored draft exists, restore the text and show a soft inline notice: "Picked up where you left off." with a dismiss/discard option — no modal, no toast spam.
- Existing server-side `post_drafts` / `DraftsDialog` flow stays untouched; this is purely a local safety net.

## 4. Drag-and-drop reordering of carousel images
- In the multi-image thumbnail strips (create + edit flows in `CreatePostCard.tsx` / `PostCard/PostCardModern.tsx` edit dialog), make thumbnails draggable with press-and-hold on touch.
- Reorder the `media_urls` array locally before publish/save; order sent to the API is the display order. Remove-button behaviour unchanged.
- Implementation: lightweight pointer-based reorder (no new dependency unless dnd-kit is already present) with a scale/shadow lift on the dragged thumbnail.

## 5. Smart @-mention ranking by proximity
- Add `useMentionSuggestions(query)` that queries existing sources and ranks results:
  1. Mutual follows / close friends
  2. Users from recent chats
  3. Remaining followers/following
  4. Global username search (fallback)
- Hook it into the composer textareas: typing `@` opens a suggestion popover, tab/tap inserts `@username`. Uses existing follower/chat queries — no new tables, no new columns.

## Technical notes
- No database schema changes.
- No existing files removed or renamed; all edits are additive except the viewport meta change.
- Regression checks after build: feed loads and paginates, post create/edit with single and multi image, chat send, offline toast appears once with Retry, themes unchanged.

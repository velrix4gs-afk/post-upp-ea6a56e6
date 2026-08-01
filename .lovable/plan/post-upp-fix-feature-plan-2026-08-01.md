# POST-UPP Fix & Feature Plan

Grouped into phases so nothing gets half-done and the workspace budget stays under control. Each phase is self-contained and verifiable; I'll stop after each phase for you to test.

## Phase 1 — Broken things (highest priority)

1. Follow from search results errors with APP001 — trace the exact failing call from the search result card's follow action, then route it through the same follow path the profile page uses so it behaves identically everywhere (search, popup, profile, suggestions).
2. Story camera capture — remove the camera option from the story creator for now, leaving gallery/file selection only.
3. Multi-image posting — allow selecting and uploading several images in one post and in one chat message, with a thumbnail strip and per-image remove.
4. Edit post with images — the edit flow gets the same media editor as create: view current images, remove them, add new ones.
5. Voice notes and calls — end-to-end pass with a real signed-in session: record, upload, send, play back, and retry after a forced failure. Same for starting a voice call and a video call from a chat, with the two clearly separated in the mobile chat header (distinct call and video-call buttons).
6. Back navigation — make the back button consistently return to the previous screen and restore what was open there (mini profile popup, sheet, tab, scroll position).
7. Long-press on a username — upgrade the popup to a richer card matching the attached reference: large avatar, name with verified badge, handle, bio, Following/Followers/Posts counts, Follow button, and tab row.

## Phase 2 — Chat and feed polish

8. WhatsApp-style bubbles — retune text/image/video bubble sizing, media aspect handling, and inline timestamp/tick placement.
9. Chat long-press preview — render the full recent conversation with date separators, not just the last snippet.
10. Feed load-more — verify with instrumentation that scrolling appends posts only and never re-renders the whole feed.
11. Theme consistency check — walk Feed, Messages, Profile, Settings after navigation and hard refresh and fix any surface that drops the selected theme.

## Phase 3 — New features

12. Post detail UI — rebuild the single-post view to match the attached reference layout.
13. Popup-first navigation — convert the screens that make sense (profile, post detail, settings sub-pages) into sheet/dialog overlays instead of full page pushes.
14. Interactive notifications — follow requests get Accept/Decline inline; tapping other notification types opens the relevant popup instead of a plain redirect.
15. Stylized gallery picker — in-app grid of the device's recent images for story creation instead of the system file dialog (uses the browser/Capacitor media picker; a true system-album grid is only possible via the native layer, so on web it falls back to a styled multi-select).
16. App-aware AI assistant — give the assistant a structured description of the app's screens, actions and routes so it can answer "how do I…" and navigate the user there.
17. Post-onboarding tutorial — short coach-mark walkthrough after onboarding finishes, skippable, shown once.

## Technical notes

- No schema changes unless a phase genuinely needs one; I'll ask first if so.
- Existing hooks and edge functions are reused — no new placeholder APIs.
- Each phase ends with a verification pass in a real signed-in browser session (screenshots, console, network) and an honest report of what was tested vs only implemented.

## Confirm before I start

Phase 1 is the bulk of the value. Approve and I'll do Phase 1 first, then check in.

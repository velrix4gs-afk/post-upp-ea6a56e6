# Issue Scratchpad with Categories

Turn the existing Agent Instructions page (`/instructions`) into a structured issue intake board with three fixed categories, each with its own text area, plus image attachments on the third category.

## Categories

1. Exists but not working (bug)
2. Needs to be added (new)
3. Doesn't work at all (broken / down)

## What gets built

- Three stacked cards, one per category, each with a title, short helper line, and a large auto-saving text area.
- Category 3 also gets an image attachment area: pick from gallery/camera, thumbnail previews in a row, tap a thumbnail to view larger, small X to remove.
- Everything auto-saves locally (same localStorage approach already used on the page), so nothing is lost on reload or app switch.
- Header keeps Clear and Copy. Copy now produces one Markdown block with all three sections and a note listing attached image filenames.
- Mobile-first spacing and safe-area padding, matching the app's existing card/theme tokens (no hardcoded colors).

## Technical notes

- Single file change: `src/pages/InstructionsPage.tsx`. No new routes, no database, no schema changes.
- State shape: `{ bug: string; missing: string; broken: string; brokenImages: string[] }` persisted under a new key `postup_issue_scratchpad_v1`; the old `postup_agent_instructions_md` value is migrated into the bug field on first load so nothing already typed is lost.
- Images stored as base64 data URLs in localStorage, downscaled client-side to max 1280px and capped (max 4 images) to stay within localStorage limits; if a write fails, a single toast explains the limit.
- Uses existing `Textarea`, `Card`, `Button`, and `useToast` components; no new dependencies.

## Question handled by default

Only category 3 gets the image field, as described. If you want images on all three, that is a one-line extension.

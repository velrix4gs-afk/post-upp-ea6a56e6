## Plan

### 1. Install Stream Video SDK

- `bun add @stream-io/video-react-sdk`
- Verify `VITE_STREAM_API_KEY` is in `.env` and `STREAM_API_SECRET` runtime secret is configured (already added in prior step).
- Confirm the `stream-token` edge function returns `{ token, apiKey, userId }` for the authenticated caller; patch if needed (CORS + Zod input validation, signed HS256 JWT with `user_id` claim).

### 2. Stream client wiring

- New file `src/hooks/useStreamVideoClient.ts`:
  - Fetch token via `supabase.functions.invoke('stream-token')`.
  - Create a singleton `StreamVideoClient` keyed by `user.id`.
  - Handle disconnect on sign-out / unmount.
- New file `src/components/calls/StreamCallProvider.tsx`:
  - Wraps app in `<StreamVideo client={client}>` when authenticated.
  - Mounted once in `App.tsx` inside the auth tree (do NOT remove existing providers).

### 3. Rewrite VoiceCall + VideoCall

- Replace internal WebRTC logic in `src/components/VoiceCall.tsx` and `src/components/VideoCall.tsx` with Stream SDK primitives:
  - Use `client.call('default', callId)` where `callId` is deterministic from sorted participant UUIDs (so both sides join the same call).
  - `call.join({ create: true })`, request mic (voice) or mic+cam (video).
  - Render Stream's `<StreamCall call={call}>` + `<SpeakerLayout/>` (video) or a custom audio-only layout (voice) using existing UI shell — keep current visual chrome, buttons, durations, and prop signatures intact so `ChatHeader`, `useVideoCall`, and `MessagesPage` call sites are unchanged.
  - End call: `call.leave()` + `call.endCall()` for initiator.
- Keep existing props (`open`, `onClose`, `peerId`, `peerName`, `peerAvatar`, etc.) — only swap the internals.
- `useVideoCall.ts`: keep ringing/notification trigger logic; only swap WebRTC offer/answer signaling for Stream's ring flow (`call.getOrCreate({ ring: true, data: { members } })`).

### 4. Chat peek modal — iOS-style polish

- Update `src/components/messaging/ChatPreviewModal.tsx`:
  - Card centred, max-w `380px`, rounded-3xl, subtle scale-in (0.92 → 1) + spring feel via Tailwind transition.
  - Header: avatar (lg), name, "tap to open" hint; tappable to call `onOpenFull`.
  - Body: last ~6 messages in iMessage-style bubbles (right = primary, left = muted), no input, no read-receipt writes.
  - Footer pill: secure close button (X) top-right and tap-outside dismissal (already partially there — confirm `touch-manipulation` + pointer-events on backdrop per memory rules).
  - Use semantic tokens only (no raw colors).

### 5. MD instructions textarea

- Add a lightweight in-app scratchpad so you can paste extended MD instructions to me:
  - New page `src/pages/InstructionsPage.tsx` at route `/instructions` (guarded by auth).
  - Single `<textarea>` bound to localStorage key `postup_agent_instructions_md` + a "Copy to clipboard" button.
- No DB writes, no schema changes. Purely a client utility so you can draft MD, copy it, and paste into chat for me to follow.
- also follow this (## Task: Rebuild Chat UI - iOS Bottom Sheet Popup + WhatsApp Chat + Working Media Gallery
  ### 1. Chat Popup - iOS Style Bottom Sheet
  **Reference**: iOS Messenger style popup covering 80% screen from bottom
  **Specs:**
  - Component: Bottom Sheet Modal, slide up animation from bottom
  - Height: 80% of viewport height
  - Top: 4px grey handle bar, 36px width, 8px from top, centered
  - Corners: 32px border radius top-left + top-right, 0px bottom
  - Overlay: 40% black background, tap overlay = close sheet
  - Swipe down: User can swipe down on handle bar to close
  **Header:**
  - Height: 56px, fixed
  - Left: [<] Back arrow icon 24px
  - Center: Contact name "ÑÖVÄ JÏÑX" bold 17px, status "online" 13px grey below name
  - Right: [Call icon] [Video icon] [••• menu icon] each 24px, 16px spacing
  - Bottom border: 1px #E5E5EA
  **Chat area inside popup:**
  - Background: #F2F2F7 light grey
  - Show last 3-4 messages as bubbles, same style as main chat
  - Bubbles: My msg = blue #007AFF right aligned, Their msg = grey #E9E9EB left aligned
  - Timestamp: 12px inside bubble bottom right
  - Media: Show image with "HD (126 KB)" tag bottom left like in reference
  **Input bar:**
  - Fixed bottom, height 52px
  - Left: [+] icon 28px
  - Center: Text input rounded 20px, placeholder "Message"
  - Right: [Camera icon] [Mic icon] 28px each
  - Padding: 12px left/right, 8px top/bottom
  **Long press menu:**
  - Appears above message on long press
  - Style: White card, rounded 16px, shadow
  - Items: Mark as unread, Archive, Mute, Lock chat, Add to Favorites. Icon + text left aligned
  - Close when tap outside
  ### 2. Fix "View All Media" Screen
  **Issues**: Won't close, wrong tab shows wrong content
  **Specs:**
  - Top bar: [X] Close 24px left, "Media" title 17px bold center, [Search] 24px right
  - Tabs: Photos | Videos | Files | Links. Active tab = blue underline #007AFF
  - Default tab: Open to the tab user clicked. If from "Videos", show Videos first
  - Photos: 3-column grid, aspect ratio 1:1, no text
  - Videos: 2-column grid, thumbnail + ▶️ center + duration bottom right "0:32"
  - Files: List with icon + filename + filesize
  - Close: X button + swipe down + tap overlay all close modal
  - Empty state: Icon + "No photos yet" centered
  ### 3. Main Chat Screen - WhatsApp Style
  **Issues**: Too much spacing, 3 timestamps, dotted bg
  **Specs:**
  - Header: Fixed. [<] + Avatar 40px + Name + "last seen today at 17:13" + [Call] [Video] [•••]
  - Background: Solid #ECE5DD. Add setting)

### 6. Out of scope (this round)

- No changes to routing structure beyond adding `/instructions`.
- No edits to auth, DB schema, or existing message logic.
- No removal of existing files or props.
- No asking weather to add something add all thats needed at once 

### Files touched

- New: `src/hooks/useStreamVideoClient.ts`, `src/components/calls/StreamCallProvider.tsx`, `src/pages/InstructionsPage.tsx`
- Edited: `src/components/VoiceCall.tsx`, `src/components/VideoCall.tsx`, `src/hooks/useVideoCall.ts`, `src/components/messaging/ChatPreviewModal.tsx`, `src/App.tsx`, `package.json` (via bun add)
- Possibly edited: `supabase/functions/stream-token/index.ts` (only if validation/CORS gaps found)

Approve and I'll execute in this order: SDK install → token verify → provider/hook → call rewrite → chat peek polish → instructions page.
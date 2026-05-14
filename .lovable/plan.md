## Goal

Fix 5 messaging/AI issues in one pass without changing data models or unrelated logic.

---

### 1. Swipe-to-delete actually works (chat list)

File: `src/components/messaging/ChatListItem.tsx`, wired in `src/pages/MessagesPage.tsx`.

Problems:

- `onDelete` in `MessagesPage` only shows a toast ("Use chat menu to delete") — swipe never deletes.
- `onArchive` says "coming soon".
- After a row is opened (`swipeX = -160`), there is no global way to close it; tapping another row leaves stale open state.
- Long-press timer can race with the swipe gesture on slow finger drags.

Fix:

- In `MessagesPage.tsx`, replace the toast-only `onDelete` with a real handler that opens a confirm dialog, then calls a new `deleteChat(chatId)` helper that removes the user's `chat_participants` row (already RLS-allowed) and refetches via `refetchChats()`. Keep `onArchive` toast for now (no schema change requested), but make Archive close the row instead of doing nothing visible.
- In `ChatListItem.tsx`:
  - Add a small `useEffect` that listens for a custom `chatlist:close-swipes` event on `window` and calls `setSwipeX(0)`. Dispatch that event from `MessagesPage` whenever a row is opened, a chat is selected, or the list scrolls.
  - In `handleTouchStart`, only start the long-press timer if `swipeX === 0` so it doesn't fire while the row is already swiped open.
  - In `handleTouchEnd`, if the swipe never crossed the 10px movement threshold, do not call `setSwipeX` at all (prevents accidental snap-back jitter).

### 2. Bottom borders on Messages list and in-chat view

Files: `src/pages/MessagesPage.tsx`, `src/index.css`.

Problems:

- The chat list currently relies on per-row `border-b border-border/30 last:border-b-0`, which is fine, but the AI assistant pinned card adds another `border-b` directly above the list, so the first chat row gets a double divider.
- In the chat view, the input section uses `border-t border-border/40` AND the messages container's wallpaper class adds its own visual line, producing a stacked border feel above the input.
- `no-bottom-pad` override is present, but the chat view still inherits 1px from a parent `border-b` on `<main>` in some themes.

Fix:

- Remove the `border-b border-border/30` from the AI pinned card wrapper in `renderListView` (let the next `ChatListItem` own the divider).
- In `renderChatView`, remove the duplicate top border on the wrapper around `TypingIndicator` + `ChatInput`. Keep only one `border-t border-border/40` on the outer input section, and drop any inner border on `ChatInput` form (`bg-card` only).
- In `index.css`, ensure `main.no-bottom-pad`, `[data-no-bottom-pad="true"]` removes both `padding-bottom` AND any `border-bottom` so the chat surfaces sit flush.

### 3. Initial message scroll: show newest first, not the top

File: `src/pages/MessagesPage.tsx` and `src/hooks/useMessages.ts`.

Problem:

- `loadMessagesFromCache` sets cached messages, the auto-scroll `useEffect` fires once with `isInitialLoadRef.current = true` and snaps to bottom. Then `fetchMessages` resolves and replaces `messages`, but `isInitialLoadRef.current` is now `false`, so the second render does NOT re-scroll. The user sees old cached top while the fresh list mounts above the viewport.

Fix:

- Track initial load until the FIRST network fetch resolves, not until the first render. In `useMessages.ts`, expose `messagesInitialLoaded: boolean` that flips to `true` only after `fetchMessages()` completes for the current `chatId`. Reset it to `false` whenever `chatId` changes.
- In `MessagesPage.tsx`, set `isInitialLoadRef.current = true` whenever `selectedChatId` changes (already done) AND keep it `true` until `messagesInitialLoaded` is `true`. Then run the existing "scroll to first unread or bottom" logic exactly once on the merged list.
- Sort safety net: in `fetchMessages`, keep `.order('created_at', { ascending: true })` (already correct) and after merging cache + network, sort by `created_at` ASC before `setMessages` to guarantee newest is at the bottom.

### 4. AI Assistant: blank replies

Files: `src/hooks/useAIChat.ts`, `supabase/functions/ai-chat/index.ts`.

Problem:

- `useAIChat` only parses an SSE `data:`  stream. The edge function's Google branch returns a non-streaming JSON body (`{ choices: [{ message: { content }}]}`), and so does the OpenAI/Anthropic error fallback. The reader sees no `data:`  lines → `assistantContent` stays empty → bubble is blank.

Fix in `useAIChat.ts`:

- After the `fetch`, inspect `response.headers.get('content-type')`.
- If it includes `text/event-stream`, keep the existing SSE loop.
- Otherwise, `await response.json()` and read `data.choices?.[0]?.message?.content` (and fallback to `data.content` for Anthropic-style). Set `streamingContent` to it, then push the assistant message exactly like the streaming path.
- Keep the existing toast on `!response.ok` so 401/402/429/500 still surface.

No edge-function changes are required for this fix; the function already returns the right shapes per provider.

### 5. AI chat history persistence

File: `src/hooks/useAIChat.ts`.

Problem:

- `messages` lives only in `useState`. Reload or navigation clears it.

Fix (frontend-only, no schema changes):

- Persist to `localStorage` under a key scoped per user: `postup_ai_chat_history_${userId}` (read `userId` from `supabase.auth.getUser()` once on mount; fall back to a generic key if not signed in).
- On mount, hydrate `messages` from that key (parse timestamps back to `Date`).
- On every `setMessages` change (via a `useEffect`), write the array back. Cap to last 100 entries to keep storage small.

`clearHistory()` also clears that localStorage key.  
  
6. animations for pages dosent match so does the what user describes it should be 120hz smooth  
7.typing in the text area once user sends it still stays there instead of sending it out immediately  
8. hold down on a users chat should preview chat in a popup view without marking as read   


This satisfies the project's "use AsyncStorage / localStorage caching" rule and does not touch DB.

---

## Verification

- Swipe a chat row left → Delete confirms → row disappears and chat list refetches.
- Open another row's swipe → previous row auto-closes.
- Chat list: only one divider between every row, including under the AI card.
- Chat view: only one divider above the input; no phantom gap below.
- Open a chat with cached + new messages → view starts at the newest message, not the top.
- Send a message in AI Assistant → response renders (streaming or JSON), no blank bubble.
- Reload the page → AI conversation history is still there until "Trash" is pressed.
- animations for pages dosent match so does the what user describes it should be 120hz smooth
- .typing in the text area once user sends it still stays there instead of sending it out immediately
-  hold down on a users chat should preview chat in a popup view without marking as read   


## Files touched

- `src/components/messaging/ChatListItem.tsx`
- `src/pages/MessagesPage.tsx`
- `src/hooks/useMessages.ts`
- `src/hooks/useAIChat.ts`
- `src/index.css`

No DB migrations, no edge function changes, no auth/routing changes.
We will focus only on the issues you listed now. Active status and read receipts will be left for later, as requested.

## Plan

1. **Chat long-press preview: match the attached Telegram-style reference**
   - Replace the current small actions-only popup with a larger centered preview overlay.
   - Show the actual chat preview: header with avatar/name/status, multiple recent messages, dates, and the same blurred/dimmed background effect from the screenshot.
   - Put the action menu below/near the preview with: Mark as read/unread, Pin/Unpin, Mute/Unmute, Delete.
   - Keep tap-outside dismissal and safe close behavior.
   - Reuse existing live chat messages from Supabase, not dummy data.

2. **Feed scrolling should not reload the whole feed**
   - Fix the feed hook so infinite scroll/loading-more does not set the same `loading` state used for the full-page skeleton.
   - Keep existing posts visible while loading more posts at the bottom.
   - Keep pull-to-refresh silent so it merges new posts without clearing the page.
   - Guard against duplicate `loadMore()` calls while the bottom sentinel stays visible.

3. **Voice notes should send and retry correctly**
   - Fix the retry lock in `VoiceRecorder`: after a failed send, tapping send again should actually retry instead of being blocked by the internal sent guard.
   - Upload voice notes with the real audio MIME type (`audio/webm`, `audio/mp4`, etc.) instead of forcing `video/webm` / `video/mp4`.
   - Keep the recorder open on failed upload/insert so the user can retry.
   - Keep using the existing `messages` storage bucket and existing `sendMessage` function.

4. **Restore theme behavior across the whole app**
   - Remove the forced `fb26` skin override that makes the app ignore the previous theme look.
   - Let the saved theme/user settings apply globally through the existing theme system.
   - Make feed and messages use semantic theme tokens so the page does not become plain white while only profile/post textarea looks themed.

5. **Make chat message bubbles closer to WhatsApp sizing/style**
   - Adjust text, image, video, and voice message bubbles to be medium-sized: not tiny, not oversized.
   - Use WhatsApp-like rounded bubbles, readable text sizing, compact timestamp/read-marker placement, and better media dimensions.
   - Keep existing actions, replies, reactions, starring, delete, image viewer, and video controls intact.

## Validation after implementation

- Open feed and scroll to bottom: existing posts should stay visible while more load.
- Pull refresh: no full feed skeleton/blank reload.
- Record and send a voice note: it should upload and insert as an audio message; failed send should allow retry.
- Long-press a chat: preview should show the actual chat conversation, not just the last text.
- Open a chat: text/image/video bubbles should visually match a WhatsApp-like size and layout.
- Check theme on feed/messages/profile: saved theme should apply consistently.

## Not included in this pass

- Active status repairs.
- Read receipt marker repairs.
- Database schema changes unless an existing storage MIME setting is proven to still block voice uploads.
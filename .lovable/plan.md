## Findings from the UI/UX scan

1. **Messages page bottom gap**
  - `src/index.css` applies mobile bottom padding to every `<main>` globally.
  - The messages page hides the bottom nav, but still receives that padding, creating the huge empty gap at the bottom.
2. **Messages page flicker/reloading risk**
  - `MessagesPage.tsx` still mounts `useFriends()` even though the returned `friends` value is unused.
  - Current console logs show repeated `[FRIEND_001] Failed to load friendships` Edge Function errors, which can contribute to visible instability on messaging surfaces.
  - `useMessages()` also toggles `chatsLoading` during background refreshes, so cached chats can briefly be replaced by loading skeletons.
3. **Settings not remembering theme/size globally**
  - Font size, layout mode, and accent color are only loaded when `SettingsPage` mounts.
  - Other pages like Feed/Messages do not apply saved `user_settings` after reload unless the user visits Settings first.
  - Theme uses localStorage only even though `user_settings.theme_preference` already exists.
4. **Chat list borders / bottom border polish**
  - Message list, AI pinned row, input area, and global mobile padding are creating inconsistent visual separation.
  - The final layout should use one clear divider where needed, not stacked borders or phantom bottom spacing.
5. **In-chat wallpaper presets issue**
  - Preset wallpapers currently save ids like `blue`, `green`, `purple` into `wallpaper_url`, but the chat view treats `wallpaper_url` as an actual CSS image URL.
  - This can cause broken background rendering for preset wallpapers.

## Fix plan

### 1. Remove the messages bottom gap without touching navigation behavior

- Add an explicit no-bottom-padding override to the messages page `<main>`.
- Keep bottom nav behavior unchanged for Feed/Reels.
- Keep the chat page full-height using `100dvh` so the input stays flush to the bottom.

### 2. Stop messaging flicker and redundant reloads

- Remove the unused `useFriends()` import/call from `MessagesPage.tsx`; `NewChatDialog` already loads eligible mutual followers through `useFollowers()`.
- Update `useMessages()` loading behavior so:
  - cached chats render immediately,
  - background refreshes do not force the skeleton loader over existing chats,
  - effects depend on stable `user?.id` instead of the full user object where possible.
- Keep existing Supabase functions, RPCs, realtime subscriptions, cache, and offline behavior intact.

### 3. Make appearance settings persist everywhere

- Add a small app-level appearance sync hook/component that loads existing `user_settings` fields:
  - `theme_preference`
  - `font_size`
  - `layout_mode`
  - `accent_color`
- Apply these to `document.documentElement` on app startup, not only inside Settings.
- Update Settings theme changes to save `theme_preference` using the existing `user_settings` table.
- Keep localStorage as immediate fallback so preferences apply quickly before Supabase responds.

### 4. Clean up borders on message list and in-chat input

- Keep one intentional separator between major areas:
  - chat header bottom divider,
  - chat input top divider,
  - list row dividers only where visually needed.
- Remove/override duplicate bottom spacing and phantom borders caused by global layout padding.

### 5. Fix chat wallpaper presets safely

- Keep custom uploaded image URLs working exactly as-is.
- Map preset wallpaper ids to CSS classes/background styles before applying them in chat view, instead of treating preset ids as image URLs.
- No schema changes.

### 6. Verification after implementation

- Test `/messages` on mobile width for:
  - no bottom gap,
  - no repeated skeleton flicker when chats already exist,
  - smooth transition into a chat,
  - input anchored correctly with one border.
- Test Settings → Appearance:
  - theme persists after reload,
  - font size/layout/accent apply on Feed and Messages without visiting Settings again.

Note: the browser preview currently showed the login screen, so final visual verification of private chat data will require the preview to be logged in.  
Note: user wants apple grade animations for all pages and apple grade design just keeping it all simple
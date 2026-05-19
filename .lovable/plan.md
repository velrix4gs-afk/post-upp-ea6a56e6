## Goal

Transform Post Up's Feed, Navigation, and Messages surfaces into a Facebook (2024–2026) look-and-feel with cinematic iOS-26-style motion. Light/airy with depth and translucency — not Liquid Glass. No business logic, no DB, no routing changes. Every existing feature stays.

## What changes

### 1. Design tokens — `src/index.css` + `tailwind.config.ts`

New "Facebook 2026" token layer scoped under `[data-skin="fb26"]` (default ON for everyone unless user opts out in Settings):
- `--background: 210 14% 95%` (#F0F2F5), surface white, card radius `0.75rem`
- `--primary: 214 89% 52%` (#1877F2), `--primary-hover` darker
- `--fb-surface-elevated`, `--fb-divider 220 13% 91%`, soft shadow tokens (`--fb-shadow-card`, `--fb-shadow-pop`)
- Spring easings: `--fb-spring: cubic-bezier(.34,1.56,.64,1)`, `--fb-glide: cubic-bezier(.22,1,.36,1)`
- Translucent depth helpers `.fb-depth-1/2/3` (white @ 70–85% + `backdrop-blur(18px) saturate(1.4)`)
- Page transition wrapper class `.fb-page-enter` (fade+scale 0.98→1, 240ms spring)

Dark variant under same skin uses `#18191A` / `#242526` (auto when system or theme=dark).

### 2. Right-side navigation panel — replaces bottom nav

New component `src/components/nav/RightSlidePanel.tsx`:
- Edge-mounted FAB (top-right, avatar) + swipe-from-right gesture opens panel
- Translucent panel (`fb-depth-2`), spring slide-in (`translateX 100% → 0`, 320ms `--fb-spring`)
- Sections: primary nav (Feed, Reels, Messages, Friends, Pages, Bookmarks, Profile, Settings), quick actions (Create post/story/reel), theme toggle, sign out
- Active route highlight, tap-outside dismiss, swipe-right close
- Replaces `<BottomNavigation />` in `App.tsx`. `BottomNavigation.tsx` kept but un-mounted (preserve file per project rule).

`Navigation.tsx` top bar is hidden on mobile when skin=fb26 (panel covers nav). Desktop keeps a slim Facebook-style top bar: logo + search pill + center icon rail (Home/Reels/Messages/Friends) + right cluster (Menu, Notifications, Avatar opens RightSlidePanel).

### 3. Feed — `src/pages/Feed.tsx` + `src/components/feed/*` + `PostCard/PostCardModern.tsx`

Mirror the standalone HTML prototype's feed:
- Soft gray canvas, centered column (max-w 680), cards = pure white w/ `--fb-shadow-card`, 12px radius
- Stories rail: rounded 12px tall cards, gradient overlay, "Create Story" first card
- Composer card: avatar + "What's on your mind?" pill button (opens existing CreatePostSimple drawer); row of Photo/Video/Reel/Live shortcuts under a divider
- PostCardModern restyled: header (avatar 40, name bold, meta row with privacy icon + dot + relative time), content, media edge-to-edge inside card, reaction stat row (emoji stack + counts), divider, action row (Like / Comment / Share) with hover bg, all existing handlers preserved
- Spring entrance on cards as they enter viewport (translateY 12→0, opacity, 280ms `--fb-spring`), liquid press feedback on actions (`active:scale-95 transition-transform`)

### 4. Messages — `src/pages/MessagesPage.tsx` and `messaging/*`

- Two-pane Messenger layout on md+: left chat list (320px, white w/ subtle divider), right chat panel
- On mobile keep current single-pane stack, but restyle: rounded search pill, pinned/active row with blue accent, swipe-to-delete row uses spring (`cubic-bezier(.34,1.56,.64,1)`), iOS-style red delete affordance
- ChatHeader: avatar + name + presence dot, right-aligned call/video/info icons in blue
- Bubbles: own = `#0084FF` gradient with white text, other = `#E4E6EB` with `--foreground`; rounded-[18px] with tail-radius variation for consecutive messages
- ChatInput: pill input + circular send button (blue primary, spring scale on press)
- Bottom borders inside chat panel removed (`border-0 border-none` on inner scroll containers) — fixes existing border bug
- AI Assistant chat tile in list; opening uses existing `AIAssistantChat` (no logic change)

### 5. Cinematic motion + zero-flicker route transitions

- Wrap `<Routes>` in `src/App.tsx` with a `<PageTransition>` component (keyed by `location.pathname`) using CSS-only fade+scale spring on mount — pure `transform/opacity`, GPU-accelerated.
- Already-eager Feed/Messages/Profile/Search stay eager; extend `usePagePrefetch` to also prefetch Reels, Friends, Bookmarks, Pages, Settings, Notifications immediately after auth (already partial). Add hover/touch preloaders to RightSlidePanel buttons (mirrors the existing `preloadRoute` pattern in `BottomNavigation`).
- Add `prefers-reduced-motion` guard to disable spring motion.

### 6. Settings — `src/pages/SettingsPage.tsx`

Add toggle "Classic Post Up look" that flips `app_skin` between `fb26` (default) and empty string. Read by existing `useAppearanceSync`. Keep Liquid Glass option alongside.

## Files

Created
- `src/components/nav/RightSlidePanel.tsx`
- `src/components/transitions/PageTransition.tsx`

Edited
- `src/index.css` (fb26 token layer + utilities)
- `tailwind.config.ts` (spring easing tokens, fb shadows)
- `src/App.tsx` (mount RightSlidePanel instead of BottomNavigation when authenticated, wrap Routes in PageTransition, default skin)
- `src/hooks/useAppearanceSync.ts` (default to `fb26` if no preference saved)
- `src/components/Navigation.tsx` (Facebook-style top bar on desktop, hidden on mobile under fb26)
- `src/pages/Feed.tsx`, `src/components/feed/CreatePostCard.tsx`, `src/components/feed/FeedTabs.tsx`, `src/components/feed/FeedSidebar.tsx`, `src/components/PostCard/PostCardModern.tsx`, `src/components/Stories.tsx`
- `src/pages/MessagesPage.tsx`, `src/components/messaging/ChatListItem.tsx`, `src/components/messaging/ChatHeader.tsx`, `src/components/messaging/ChatInput.tsx`, `src/components/EnhancedMessageBubble.tsx`
- `src/pages/SettingsPage.tsx` (skin toggle)
- `index.html` (anti-flash skin script already exists — extend default to fb26)

Untouched: every hook, every Supabase call, every edge function, routes, auth, schema, UUIDs, `BottomNavigation.tsx` file itself (just unmounted).

## Out of scope (Phase 2 candidates)

Profile, Reels, Search, Explore, Settings sub-pages, Notifications panel restyling, Stories viewer, Page profiles. They keep working — just inherit token colors but not the full Facebook restyle yet.

## Risk + verification

- No schema, no API, no logic changes → zero data risk.
- After build, verify in preview: Feed renders, post create works, message send works, AI chat opens, route switches don't flicker, swipe-to-delete on chat list still triggers, right panel opens/closes.
- Reduced-motion users get instant transitions.

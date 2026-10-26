# Project Overview
POST UP (POST-UPP) is a social app — feed, stories ("Showcases"), real-time messaging, voice/video calls, and push notifications. Built originally in Lovable, now hand-edited directly in the repo. The goal right now is finishing out core social features (composer, chat media, voice notes) and polishing the UI with a set of custom animated components ("flair" components) before a wider release.

# Tech Stack & Architecture
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + RLS + Edge Functions + Storage + Realtime + `pg_net` for DB-triggered HTTP calls)
- **Mobile:** Capacitor (Android target)
- **Calls:** Stream Video SDK (`@stream-io/video-react-sdk`) — use its built-in `participant.audioLevel` (0–1) for speaking indicators, don't hand-roll Web Audio tapping
- **Push:** Firebase Cloud Messaging, HTTP v1 API, OAuth2 JWT signed server-side in an Edge Function from a service-account secret (`FIREBASE_SERVICE_ACCOUNT`) — no legacy server key
- **Email:** Resend, sender `onboarding@resend.dev` (works without a verified domain)
- **State:** Local component state + hooks (e.g. `useMessages`, `useAuth`) — no Redux/Zustand/Context-heavy architecture. Don't introduce a new state library.
- **Styling:** Tailwind utility classes, shadcn/ui primitives in `src/components/ui/`. No CSS-in-JS.
- **Deploy:** Vercel (auto-deploys `main`), build command is `bun run build` — check Vercel build logs on failures, not just local.
- **Supabase project ref:** `ccyyxkjpgebjnstevgkw`
- **Custom animated component library:** `src/components/flair/` — JellyRadio, GradualBlur, PulseHeart, ClickSpark, DepthCarousel, VoicePill. These came from user-supplied reference files (ReactBits-style), each with a specific intended use noted by the user (e.g. PulseHeart = like button, ClickSpark = reaction/action buttons, DepthCarousel = multi-image carousels, VoicePill = voice-note record trigger).

# Current Progress
- Push notifications: `send-push` Edge Function (FCM HTTP v1), `device_tokens` table + RLS, DB trigger (`notify_push_on_notification`) that fires on `notifications` insert via `pg_net`, native registration hook `usePushNotifications`, Android manifest/`google-services.json` wired.
- Voice-call visualizer: `CrystalizedBall` (WebGL/`ogl`) wrapped by `CallAudioOrb`, driven by Stream's live `audioLevel`, rendered in `CallShell`/`VoiceCall`.
- Post composer consolidated: deleted the two old inline composers (`CreatePost.tsx`, `CreatePostCard.tsx`), replaced with one full-screen `CreatePostPage` at `/create/post`. Profile no longer has an inline composer; feed uses a slim `ComposerTriggerBar` that navigates to it.
- All 6 flair components extracted, cleaned (two — `VoicePill.tsx` and `PulseHeart.tsx` — had gotten corrupted by a Markdown-rendering pass and were repaired), and wired in:
  - JellyRadio → gallery picker's All/Photos/Videos filter
  - GradualBlur → bottom fade on profile Posts tab and on the chat image-history page (had to portal it to `document.body` on the profile page — a page-transition CSS animation was silently breaking `position: fixed`)
  - PulseHeart + ClickSpark → post card like/comment/share/save row
  - DepthCarousel → **chat only** (not the feed — feed multi-image posts use the original flat `Carousel` again, that was a deliberate revert)
  - VoicePill → the mic trigger button in `ChatInput` (press-and-hold starts recording; it's just the trigger, not the recording screen)
- **Multi-image chat messages (new):** `messages` table got a new `media_urls text[]` column. `useMessages.ts`'s `sendMessage()` now accepts an optional `mediaUrls[]`. When a user selects multiple photos (no video mixed in) in chat, they now upload and send as ONE message instead of one message per photo. `EnhancedMessageBubble.tsx` renders that as a borderless DepthCarousel. Mixed photo+video selections still send one-per-message (unchanged, intentional fallback).
- **Voice recorder redesigned (`VoiceRecorder.tsx`):** layout is now delete (far-left edge) → pause/resume (real `MediaRecorder.pause()/resume()`, not fake) → waveform + timer (fills the middle) → send (far-right edge). Old version had a non-functional record button; that's gone.
- Fixed a dependency-version bug that broke the Vercel build: `@hugeicons/react` was pinned to `^0.3.0` (predates the `HugeiconsIcon` named export VoicePill needs) — bumped to `^1.1.10`.
- New deps added this cycle: `motion`, `gsap`, `@hugeicons/react`, `@hugeicons/core-free-icons`, `ogl`, `@capacitor/push-notifications`.

# Immediate Next Steps
- Nothing is currently queued/half-finished — the last batch of work (multi-image chat + voice recorder redesign + GradualBlur fixes) is committed and pushed to `main`.
- User still needs to: run `npm install` (or `bun install`) locally to pick up the new deps, then `npx cap sync android` before the next Android build, and manually test on a real device — several of the flair components (DepthCarousel drag feel, VoicePill hold gesture) haven't been verified on an actual touchscreen yet, only reasoned through code.
- Deferred by the user for a future session (not started): voice-note playback UI redesign, and an AI-chat (1:1 assistant) audio visualizer — user said they'll send reference code for both later.
- Worth a close manual read: `VoicePill.tsx` and `PulseHeart.tsx` were reconstructed from a corrupted paste (Markdown entity-escaping had mangled brackets/underscores/asterisks) — logic was verified by reversing the known escape pattern and checking bracket balance with a real TS parser, but neither has been exercised in a running build yet.

# Code Snippets (If Applicable)
None — all code discussed has already been committed and pushed to `main` on `velrix4gs-afk/post-upp-ea6a56e6`.

# Strict Rules for the AI Agent
- **Never commit secrets.** This project has live secrets (Firebase service-account private key, Resend API key) that must only ever be set via the Supabase dashboard (`Project Settings → Edge Functions → Secrets`), never pasted into code, env files committed to git, or echoed in logs/commit messages.
- Always use TypeScript — no `any` unless there's genuinely no alternative, and prefer explicit types on function signatures/props.
- Match existing patterns: shadcn/ui primitives from `src/components/ui/`, Tailwind utility classes (no inline styles unless dynamic, e.g. CSS custom properties), hooks in `src/hooks/`, Supabase calls via the existing `supabase` client from `@/integrations/supabase/client`.
- Respect Supabase RLS — never write a migration or query that bypasses RLS without an explicit reason agreed on first; service-role-only operations belong in Edge Functions, not client code.
- Don't introduce a new state-management library, routing library, or CSS framework without asking first — this is an established stack.
- Before deleting or replacing an existing component, `grep` for all its usages first and confirm nothing else depends on it.
- When editing a file that already has uncommitted or recent unfamiliar changes, review the diff carefully before building on it — don't assume a clean slate.
- Run a real syntax/type check (`tsc`, or equivalent) before calling work done — don't rely on eyeballing or naive bracket-counting.
- Follow the existing git workflow: `git fetch` → `git pull --rebase --autostash origin main` → stage only the relevant files (never blanket `git add -A` without reviewing `git status` first) → commit → `git pull --rebase origin main` again → `git push origin HEAD:main`.
- Keep commits scoped and the messages descriptive (what changed and why), not just "update files".
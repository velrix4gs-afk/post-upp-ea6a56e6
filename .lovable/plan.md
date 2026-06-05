# Offline-First Architecture + Call UI Placeholders

## Security first (non-negotiable)
- The Redis host, port, and password are NEVER written into any file in this repo. They live only as edge-function secrets (`REDIS_URL`, `REDIS_TOKEN`) added via the secrets tool, accessed server-side through `Deno.env.get(...)`.
- No `redis` npm package, no direct TCP/WS connection from the browser, no `createClient()` on the client.
- A short `docs/REDIS_SECRETS.md` explains the contract: credentials are injected in the Supabase dashboard, never committed.

## What already exists (reuse, do not duplicate)
- `src/lib/cache.ts` — IndexedDB wrapper, DB `postup_cache` (posts/profiles/reels/pages/stories).
- `src/lib/offlineQueue.ts` + `src/hooks/useOfflineSync.ts` — `online` listener + pending queue.
- `src/components/VoiceCall.tsx`, `VideoCall.tsx`, `IncomingCallOverlay.tsx`, `useVideoCall.ts`, Stream Video SDK provider.

The plan extends these instead of replacing them, to honor the project rule "never remove or rename existing files / behavior".

## 1. IndexedDB — `postupp_local_cache`
New file `src/lib/localCache.ts` (separate DB so existing `postup_cache` keeps working):
- Native IndexedDB (no new dependency), DB name `postupp_local_cache`, version 1.
- Stores:
  - `messages` — keyPath `id`; fields `id, conversationId, text, timestamp, syncStatus, senderId, mediaUrl?, mediaType?`. Index on `conversationId` and `syncStatus`.
  - `interactions` — keyPath `id`; fields `id, postId, type ('like'|'comment'), content, timestamp, syncStatus, userId`. Index on `postId` and `syncStatus`.
- API: `putMessage`, `listMessages(conversationId)`, `putInteraction`, `listPendingMessages()`, `listPendingInteractions()`, `markSynced(store, id)`.

## 2. Optimistic UI hooks
- `src/hooks/useOptimisticMessages.ts` — wraps existing `useMessages`. On `send()` it: (a) writes to IndexedDB with `syncStatus:'pending'` + temp UUID, (b) merges into the in-memory list immediately, (c) calls the existing send API; on success flips `syncStatus:'synced'` and reconciles ID; on offline, stays pending. No spinner, no blocking.
- `src/hooks/useOptimisticInteractions.ts` — same shape for like/comment using existing reactions/comments APIs.

These hooks are additive — current components keep working; messaging/post components opt in.

## 3. Background sync engine
New `src/lib/syncEngine.ts`:
- Singleton initialized once from `App.tsx` (alongside existing `useOfflineSync`).
- `window.addEventListener('online', flush)` + initial flush on boot if `navigator.onLine`.
- `flush()` batches pending records (chunked) and POSTs to the API gateway endpoints:
  - messages → `messages-v2` edge function (existing).
  - interactions → existing `reactions` / `posts` endpoints.
- On 2xx response, calls `markSynced`. On failure, leaves as pending (no infinite loop — exponential backoff between flushes).

## 4. API gateway client
New `src/lib/apiGateway.ts`:
- Reads `import.meta.env.VITE_API_GATEWAY_URL` (falls back to the Supabase Functions URL derived from `VITE_SUPABASE_URL`). Variable is added to `.env.example` only.
- Thin typed methods: `post(path, body)`, `get(path)`, attaches the current Supabase JWT, handles JSON + errors. Reuses existing `supabase.functions.invoke` under the hood so we don't duplicate auth logic.
- All mutations go through this client — never direct fetch to a hardcoded host.

## 5. Edge-side Redis bridge (server only)
New edge function `supabase/functions/redis-bridge/index.ts`:
- Reads `REDIS_URL` + `REDIS_TOKEN` from env (we will request these via the secrets tool — values entered by you, never echoed).
- Uses the Upstash REST API over HTTPS (no TCP, works in Deno).
- Exposes `GET`/`SET`/`DEL` style operations gated by JWT + per-user key namespacing so one user can't read another's cached blob.
- Client calls it through `apiGateway` only.

## 6. Call UI placeholders
- Keep existing `VoiceCall`, `VideoCall`, `IncomingCallOverlay`, Stream wiring untouched.
- Add `src/components/calls/CallPlaceholders.tsx` — pure-UI mobile-responsive scaffolds:
  - `ActiveCallScreen` — remote video node, local PiP preview, mute/speaker/end-call controls, semantic tokens only.
  - `IncomingCallToast` — high-priority toast with Accept/Decline.
- Add `src/lib/callSignaling.ts` with documented stubs `initiateWebRTCCall()`, `handleIncomingSignal()`, `endCall()`. Each has a JSDoc block stating: "Replace with Agora/Twilio/custom signaling broker — sandbox cannot host a media server." Stream SDK path remains the live implementation.

## 7. Files (summary)
New:
- `src/lib/localCache.ts`, `src/lib/syncEngine.ts`, `src/lib/apiGateway.ts`, `src/lib/callSignaling.ts`
- `src/hooks/useOptimisticMessages.ts`, `src/hooks/useOptimisticInteractions.ts`
- `src/components/calls/CallPlaceholders.tsx`
- `supabase/functions/redis-bridge/index.ts`
- `docs/REDIS_SECRETS.md`, `.env.example` entry for `VITE_API_GATEWAY_URL`

Edited (minimal):
- `src/App.tsx` — boot `syncEngine` once.

Not touched: existing messaging hooks/components, existing call components, DB schema, auth, routing.

## 8. Out of scope
- No schema migrations.
- No removal/rename of files.
- No client-side Redis. No credentials anywhere in the repo.
- No spinner/blocking UI for offline reads — components read from IndexedDB and render immediately.

## Order of work
1. `localCache.ts` + tests of read/write through devtools.
2. `apiGateway.ts` + `.env.example`.
3. `syncEngine.ts` wired in `App.tsx`.
4. Optimistic hooks (opt-in, no breakage).
5. Call placeholders + signaling stubs.
6. `redis-bridge` edge function (after you confirm and add `REDIS_URL`/`REDIS_TOKEN` as secrets).
7. `docs/REDIS_SECRETS.md`.

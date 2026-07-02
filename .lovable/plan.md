## Scope

Three independent changes. No schema changes, no auth flow changes, no UUID or routing rewrites. Only add fields to the existing `profiles` row and reuse existing hooks.

---

### 1. Full-screen on iOS (notch + Dynamic Island)

Enable edge-to-edge rendering so the app paints under the camera cutout and Dynamic Island, then pad UI back in with safe-area insets.

- `index.html` — update the viewport meta to `viewport-fit=cover` and add `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`.
- `src/index.css` — add safe-area padding utilities (`padding-top: env(safe-area-inset-top)` etc.) applied to the app shell root and any fixed top bars.
- Fixed/sticky elements to adjust so they don't sit under the Dynamic Island:
  - `src/components/Navigation.tsx` (top banner)
  - `src/components/BottomNavigation.tsx` (bottom bar — `padding-bottom: env(safe-area-inset-bottom)`)
  - `src/components/messaging/ChatHeader.tsx` and `ChatInput.tsx`
- No layout redesign — just insets so nothing changes visually except no more white bar under the notch.

---

### 2. Comment button opens a popup composer (not the post page)

Currently the comment button on `PostCardModern` navigates to the full post view. Change it to open a lightweight bottom-sheet / dialog with the comment textarea + existing comments list, reusing `CommentsSection`.

- `src/components/PostCard/PostCardModern.tsx` — replace the navigate-to-post handler on the comment button with `setCommentsOpen(true)`.
- Wrap `CommentsSection` in a shadcn `Sheet` (mobile, bottom) / `Dialog` (desktop) inside the card. Auto-focus the textarea on open.
- Keep the existing "open full post" behavior on the post body/image click — only the comment icon triggers the popup.
- No changes to `useComments` or comment write logic.

---

### 3. Post-signup onboarding wizard (username → display name → avatar → interests)

After OTP verification the user lands on `/feed`. Add a one-time onboarding flow gated on `profiles.is_profile_complete = false`.

**Flow:** New route `/onboarding` with 4 steps in a single component:

1. **Username** — text input with debounced availability check against `profiles.username` via `supabase.from('profiles').select('id').eq('username', ...).maybeSingle()`. Green check when available, red X when taken. Validates with existing `usernameSchema` from `src/lib/validationSchemas.ts`.
2. **Display name** — text input, `displayNameSchema`.
3. **Profile picture** — upload to existing `avatars` storage bucket, reuse the pattern from `ProfileEdit.tsx`.
4. **Interests** — multi-select chips (reuse `UserInterestTags.tsx` categories) written to the existing `interests` field on `profiles` (already present per `useProfile`); no new column.

**Gating:**

- `src/pages/EmailVerification.tsx` — on successful verify, navigate to `/onboarding` instead of `/feed` for brand-new users.
- `src/components/ProtectedRoute.tsx` — after auth loads, if `profiles.is_profile_complete === false` and current route ≠ `/onboarding`, redirect to `/onboarding`.
- On wizard completion: `update profiles set username, display_name, avatar_url, interests, is_profile_complete = true` then navigate to `/feed`.

**New files:**

- `src/pages/OnboardingPage.tsx` — wizard shell with step state.
- `src/components/onboarding/StepUsername.tsx`, `StepDisplayName.tsx`, `StepAvatar.tsx`, `StepInterests.tsx`.

**No new DB columns** — `username`, `display_name`, `avatar_url`, `interests`, `is_profile_complete` all already exist on `profiles`.  
  
  
5 add fixing voice notes not sending it used to and work perfectly now it records and dosent send fix simultaneously 

---

## Out of scope

- No changes to auth/OTP logic itself.
- No changes to routing tree beyond registering `/onboarding`.
- No visual redesign of feed, post cards, or nav — only the safe-area padding and the comment-icon behavior swap.
- Existing users with `is_profile_complete = true` see no change.
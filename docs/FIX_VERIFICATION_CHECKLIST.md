# POST-UPP — Fix Verification Checklist

Everything below is **already committed and pushed** to `main` (`eb087dc`).
The two SQL migrations are **already applied** and verified against the live database.

This list is what to test, in priority order. If something fails, the note under it
says what to capture so it can be diagnosed.

---

## Priority 1 — The things that were completely broken

### 1. Post a Showcase with an image
**Where:** Feed → "+ Your Showcase" bubble → Gallery → pick a photo → Share Showcase

**Expected:** It appears in the Showcase tray within a second or two, without reloading.

**Was broken because:** the storage read policy still queried `public.stories`,
which the rename had dropped. Storage rejected the read, and the client silently
discards any Showcase whose media it cannot resolve.

**If it fails:** open DevTools → Console, post again, copy any red error. The exact
message matters — a storage error and a row-level-security error need different fixes.

---

### 2. Post a text-only Showcase
**Where:** Feed → "+ Your Showcase" → Text → type → Share

**Expected:** Same as above — appears immediately.

---

### 3. Reload the feed after posting
**Expected:** Both items are still there. This proves it was actually saved and is not
just sitting in local state.

---

### 4. Edit profile → add a social link → Save
**Where:** Settings → Edit Profile → Instagram (or any social field) → Save

**Expected:** "Profile updated successfully". Reload the page — the link is still there.

**Was broken because:** `social_links` was added to the database *after* the migration
that re-granted column access, so reading it returned `42501 permission denied`. The
save's own read-back then failed, and the whole update was discarded. Silent cancel.

**If it fails:** note the exact toast text. "Permission denied" means a grant is still
missing; anything else is a different cause.

---

## Priority 2 — Calls

### 5. Speaker button while ringing
**Where:** Start a voice call (or video) → look at the connecting screen

**Expected:** A speaker toggle next to Cancel, **before** the call connects.

**Was broken because:** the speaker button only existed in the active-call controls,
which mount after Stream connects. Since connecting never succeeded, it never appeared.

---

### 6. Call connects end to end
**Expected:** Timer starts, audio flows both ways, mute/camera/speaker all work.

**Requires:** the `stream-token` function redeployed. If calls still fail at the
connecting screen, the function is still the old version.

**If it fails:** capture the exact on-screen error text. "Supabase did not authorize"
means the function did not redeploy; "Stream did not authorize" is a different problem.

---

## Priority 3 — Notifications and sharing

### 7. Missed call notification reads as text
**Where:** Call someone who does not answer

**Expected:** The notification and browser push read **"Missed voice call"**.

**Was broken because:** the call summary is stored as JSON in the message body for the
in-app call bubble, and the notification trigger copied that JSON verbatim into the
notification text.

**If it fails:** paste the exact text you see.

---

### 8. Share a profile link
**Where:** Your profile → Share

**Expected:** The link uses the domain you are actually on (`post-upp.vercel.app`,
not `lovable.app`).

**Was broken because:** the canonical and OG URLs were hardcoded to the Lovable host.

---

### 9. Username links
**Where:** Tap a username on a post, or a search result

**Expected:** URL reads `/profile/<username>`, not `/profile/<uuid>`.

**Note:** a UUID still resolves correctly — that fallback was kept on purpose for
places where only an id is available.

---

## Priority 4 — Known limitation, not a bug

### 10. Link preview shows the profile picture
**Expected (goal):** Pasting your profile link into WhatsApp/Telegram shows your avatar.

**Reality:** The OG tags are now correct in the page, but crawlers fetch raw HTML and
**do not run JavaScript**. This app is a client-side SPA, so they may still see the
generic site preview.

**This is unfinished work, not a regression.** Real per-profile previews need either
prerendering or a small edge function that serves OG tags for `/profile/:username`.
Flag it as a separate task.

---

## Regression checks — confirm nothing broke

- [ ] Feed loads and posts render
- [ ] Messages send and receive
- [ ] Showcase viewer: swipe, reply, delete, share-to-feed all work
- [ ] Profile page loads for your own profile and someone else's
- [ ] Settings page opens and saves
- [ ] Build still passes (`vite build`)

---

## Already verified by inspection, no action needed

- [x] Both migrations applied — audience rules active, `social_links` correctly
      still private to signed-in users
- [x] `vite build` passes on the upgraded vite 6.4.3
- [x] `tsc --noEmit` clean
- [x] No new lint errors (353 problems, identical to before)
- [x] Dev server serves every touched module

---

## One-time cleanup

**Refresh the expired token in `.git/config`.** The `origin` remote has an old
`ghp_...` token embedded, so pushes from that folder fail with
"Invalid username or token". Replace it, or switch to a credential helper.

---

## How to report a failure

For anything that fails, send me:

1. **Which number** from this list
2. **What you expected** vs **what happened**
3. **The exact error text** (browser console, toast, or on-screen)
4. **A screenshot** if it is visual

That is enough to fix it without guessing.

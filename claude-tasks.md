# Task: Chat image carousel redesign, voice-recorder delete animation, and dialing back GradualBlur

You're picking this up mid-stream on an existing React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase project (POST UP / POST-UPP). Three separate fixes below — treat them as independent tasks, don't bundle commits. Read the relevant file fully before editing; don't guess at surrounding code you haven't seen.

---

## 1. Chat multi-image carousel: kill the "black box", make it Instagram-style

**File:** `src/components/EnhancedMessageBubble.tsx`
**Component it renders:** `src/components/flair/DepthCarousel.tsx`

### Current state
Multi-image chat messages (`message.media_urls`, set when a user sends 2+ photos together) render like this inside `EnhancedMessageBubble.tsx`:

```tsx
{isMultiImage && (
  <div className={cn("relative group", isNew && "media-drop", isImageOnly ? "mb-0" : "mb-2")}>
    <div
      className="relative w-[min(76vw,320px)] h-[220px] overflow-hidden rounded-[18px] bg-black"
      onClick={() => setShowImageViewer(true)}
    >
      <DepthCarousel
        items={mediaUrls!.map((url, i) => ({ image: url, alt: `Photo ${i + 1}` }))}
        cardWidth={160}
        cardHeight={200}
        radius={14}
        tint="#000000"
        depth={110}
        spread={48}
        tilt={14}
        visibleCards={3}
        falloff={0.25}
        blur={4}
        showControls
        showIndicators={mediaUrls!.length <= 8}
        onChange={(idx) => setActiveMultiIndex(idx)}
      />
    </div>
    {/* ...timestamp pill... */}
  </div>
)}
```

`DepthCarousel` does a 3D depth-stack effect — cards receding into depth with tilt, sitting inside a fixed-size box with a solid black background (`bg-black` wrapper + `tint="#000000"`). This reads as a letterboxed "black box" sitting inside the chat bubble. That's the complaint.

### What it should look like instead
Instagram's post carousel: the **current photo fills the full width of the bubble edge-to-edge**, no dark letterbox/padding around it, no visible 3D tilt/depth stacking — it's a flat horizontal swipe that **snaps one photo at a time**, with the **next/previous photo barely peeking in at the left/right edges** as you drag (that peek is the "wing" effect — a sliver of the adjacent image visible at the edge, not a tilted 3D card floating behind it). A small pill/dot indicator (like IG's dots, or a "2/5" counter) sits over the bottom of the image, same as the existing single-image chat bubble already does.

### What to do
1. First, read `src/components/flair/DepthCarousel.tsx` in full and check whether its existing props (`tint`, `spread`, `tilt`, `visibleCards`, `falloff`, `blur`) can be tuned down to effectively kill the 3D/depth look and approximate a flat edge-to-edge swipe (e.g. `tilt={0}`, `depth` near 0, `tint="transparent"`, `cardWidth`/`cardHeight` set to fill the container, `visibleCards` lower). If it can get there cleanly, do that — it's less code than a rewrite.
2. If `DepthCarousel`'s architecture (3D perspective transforms, depth-stacked cards) can't honestly produce a flat full-bleed swipe no matter how the props are tuned, **don't force it** — build or reuse a flat, full-bleed, swipeable image carousel instead for this specific spot (the existing shadcn `Carousel` component used elsewhere in the app, e.g. in `src/components/PostCard/PostCardModern.tsx`'s multi-image post rendering, is a reasonable reference for the pattern already in this codebase — but make it edge-to-edge/full-bleed here instead of the padded/rounded version used there).
3. Remove the `bg-black` wrapper div and the black `tint` — the carousel should show only the photos, no dark letterbox.
4. Keep: the bubble stays borderless when it's image-only (no caption/reply/forward) — that logic already exists via `isImageOnly` in the same file, don't touch it.
5. Keep: tapping the image should still open `ImageViewer` at the currently-active index (`activeMultiIndex` state + `onChange` callback) — that wiring already works, just carry it over to whatever implementation you land on.
6. Match width/sizing to the existing single-image bubble sizing for consistency: `w-[min(76vw,320px)]` and roughly the same height range other chat media uses (`max-h-[340px]` is what single images in this same file use).

If you're not sure whether the result actually matches "Instagram-style" after implementing, **stop and ask the user for a screenshot comparison** rather than guessing further — this is a visual/feel judgment call, not something to keep iterating blind.

---

## 2. Voice recorder delete: animate disposal into the bin, no overlay

**File:** `src/components/VoiceRecorder.tsx`

### Current state
The recorder bar has a delete button (far-left, trash icon) that calls `handleDelete()`:

```tsx
const handleDelete = () => {
  if (isSending) return;
  stopRecording(false);
  onCancel();
};
```

`onCancel()` is passed in from the parent (`src/pages/MessagesPage.tsx`, where `VoiceRecorder` is conditionally rendered based on `isRecordingVoice` state) and immediately sets `isRecordingVoice` to `false`, which unmounts `VoiceRecorder` instantly — the whole recording bar just disappears with no transition.

### What to do
When the user taps delete, play a short animation of the recording bar's content (the waveform/timer, or the whole bar) being "tossed" or "sucked" into the trash icon before it actually unmounts — something like: the waveform/timer area shrinks and slides/fades toward the trash icon on the left, maybe with a slight rotation or scale-down, finishing in under ~350–400ms, then call `onCancel()` to unmount.

**"Without any visual obstruction" means:** no modal, no dimmed backdrop, no confirmation dialog blocking the screen while this happens — it has to be a lightweight inline animation on the existing bar itself, not an overlay on top of the chat.

Implementation approach:
1. Add a local `isDeleting` state to `VoiceRecorder`.
2. In `handleDelete`, instead of calling `stopRecording(false)` + `onCancel()` immediately, set `isDeleting = true`, stop the actual MediaRecorder/stream right away (so the mic releases immediately — don't wait on the animation for that), but delay the `onCancel()` unmount call until the animation finishes (`setTimeout` matching the animation duration, or a CSS `transitionend`/Framer-Motion `onAnimationComplete` callback — this project already has `motion` (the Framer Motion rebrand package) installed and used in `src/components/flair/JellyRadio.tsx`, so prefer that over raw CSS keyframes if it's easy).
3. While `isDeleting` is true, animate out the waveform bars and timer (shrink/fade/slide toward the trash icon), and give the trash icon itself a quick receiving animation (e.g. a brief scale pulse) at the same time.
4. Disable the pause/send buttons during the delete animation so a stray tap can't do something while it's mid-flight.

---

## 3. GradualBlur: dial it back, it's too strong

**Files:**
- `src/pages/ProfilePage.tsx` — current usage:
```tsx
<GradualBlur
  position="bottom"
  height="4.5rem"
  target="page"
  strength={1.6}
  layers={6}
  tint="hsl(var(--background))"
  autoHide
  zIndex={30}
/>
```
(Note: this one is wrapped in `createPortal(..., document.body)` because the page-transition CSS wrapper elsewhere in the app breaks `position: fixed` — **keep the portal**, only touch the blur's own props.)

- `src/pages/ChatMediaPage.tsx` — current usage:
```tsx
<GradualBlur
  position="bottom"
  height="3.5rem"
  target="parent"
  strength={1.4}
  layers={6}
  tint="hsl(var(--background))"
  zIndex={20}
  className="rounded-b-lg"
/>
```

### What to do
Component source is `src/components/flair/GradualBlur.tsx` — read it to understand how `strength` and `layers` compose (roughly: `strength` scales max blur radius, `layers` controls how many discrete blur steps make up the gradient — fewer/weaker of either means a subtler, less "foggy" fade).

Reduce the intensity on both usages above. Reasonable starting point: drop `strength` to somewhere around `0.8`–`1.0` (from 1.6 / 1.4) and consider dropping `layers` slightly (e.g. 4–5 instead of 6) for a smoother, less heavy-handed gradient. Also consider shrinking `height` a little (e.g. `3.5rem`→`2.5rem` on profile, `3.5rem`→`2.5rem` or smaller on chat media) since a shorter fade zone reads as subtler even at the same strength.

**Don't just guess one value and call it done** — this is a "too much" complaint about feel, so after lowering the numbers, describe to the user what you changed (old vs new values) and ask them to actually look at it before moving on, since blur intensity is inherently a visual judgment call that's easy to overcorrect in either direction.

---

## General rules (carry over from the existing project conventions)
- TypeScript throughout, no `any` unless truly unavoidable.
- Match existing Tailwind/shadcn patterns already in these files — don't introduce a new styling approach.
- Don't touch Supabase schema/RLS for any of this — these are UI-only changes.
- Run a real syntax check (`tsc --noEmit` or equivalent) on every file you touch before considering a task done.
- Follow the existing git workflow already used on this repo: `git fetch` → `git pull --rebase --autostash origin main` → stage only the files you actually changed (check `git status` first, never blanket `git add -A`) → commit with a clear message describing what changed and why → `git pull --rebase origin main` again → `git push origin HEAD:main`.
- Keep the three tasks in separate commits.
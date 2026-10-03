# POST-UPP Feed Recommendation Architecture

> **Status:** Specification with v1 and client-side v2 implementation
> **Scope:** Global public broadcast feed ranking, dwell-time interest learning, and delivery mix.
> **Rollout:** v1 (signals + base rank) → observe → v2 (personalization + mix)

---

## 1. Objective

POST-UPP is a global public broadcast wall: every public post is eligible for every user's feed, regardless of follow relationships. This architecture turns that global pool into an adaptive, personalized stream that learns from silent dwell time and explicit engagement, while preserving safety, diversity, and discovery for new creators.

**Design constraints**

- No follower-based gating of candidates.
- Learning happens client-side first (low latency, privacy-friendly, no expensive server recomputation).
- Every creator receives guaranteed impressions.
- Cold-start users get a meaningful feed from post 1.
- The system must survive adversarial behavior (fake dwell, spam bursts).

---

## 2. Signal Capture

Signals are captured silently as the user scrolls. Each contributes a weight to the active post's author and topic affinities.

### 2.1 Passive signals (undirected — confidence-weighted)

Dwell alone is *directionless*: users dwell on content they love and content they hate. Raw dwell must be combined with downstream actions before it counts as positive.

| Signal | Condition | Raw weight | Confidence factor | Effective |
| --- | --- | --- | --- | --- |
| Skip | `< 1.2s` in viewport | `-0.2` | `1.0` | `-0.2` |
| Dwell (neutral) | `3.0s – 8.0s`, no downstream action | `+0.5` | `0.4` | `+0.2` |
| Dwell (engaged) | `3.0s – 8.0s` **and** like/comment/save/follow | `+0.5` | `1.5` | `+0.75` |
| Deep dwell (neutral) | `> 8.0s`, no downstream action | `+1.2` | `0.5` | `+0.6` |
| Deep dwell (engaged) | `> 8.0s` **and** like/comment/save/follow | `+1.2` | `1.5` | `+1.8` |
| Video completion | video watched `> 60%` | `+1.0` | `1.0` | `+1.0` |
| **Video rewatch** | loop count `>= 2` | `+2.5` | `1.0` | `+2.5` |

The **confidence factor** prevents rage-bait and shock content from teaching the model that a user loves it.

### 2.2 Micro-actions

| Signal | Weight |
| --- | --- |
| Expand comment drawer | `+1.5` |
| Carousel photo swipe | `+1.0` per slide (cap `+3.0`) |
| Author profile inspection (`> 2s`) | `+1.8` |

### 2.3 Super-signals

| Signal | Weight |
| --- | --- |
| Share via DM | `+3.0` |
| Bookmark / Save | `+2.5` |
| Comment | `+2.0` |
| Follow author | `+2.5` |
| Like | `+1.0` |

Rationale: sharing privately is the strongest statement of value a user can make, far stronger than a like, which is often reflexive.

### 2.4 Negative signals (explicit)

| Signal | Weight |
| --- | --- |
| "Not interested" / Hide | `-3.0` |
| "Hide all from [topic]" | `-5.0` on hashtag |
| Mute author | `-5.0` on author |
| Unfollow author | `-3.0` on author |
| Report post | hard exclude author from feed pool |
| Block | hard exclude (both directions) |

### 2.5 Reaction sentiment split

When a user reacts, weight by reaction type rather than a flat `+1.0`:

| Reaction | Weight |
| --- | --- |
| ❤️ Love | `+1.2` |
| 👍 Like | `+1.0` |
| 😆 Haha | `+0.6` |
| 😮 Wow | `+0.8` |
| 😢 Sad | `+0.4` |
| 😡 Angry | `-0.6` |

Angry reactions reduce affinity for the topic — a post that outrages a user shouldn't teach the model they want more of it.

---

## 3. Local Affinity Vector

Stored in local storage under `postupp_affinity_profile`.

```ts
type PostFormat = 'video_reel' | 'multi_photo' | 'text_status' | 'link_post';
type ReactionType = 'love' | 'like' | 'haha' | 'wow' | 'sad' | 'angry';

interface AffinityProfile {
  version: 1;
  hashtags: Record<string, number>;      // topic score per hashtag
  formats: Record<PostFormat, number>;   // format preference ratios
  authors: Record<string, number>;       // authorId -> affinity multiplier
  mutedKeywords: string[];               // user-suppressed terms
  blockedAuthors: string[];              // hard-excluded authorIds
  session: {
    startedAt: string;                   // ISO of current session start
    hashtags: Record<string, number>;    // session-local affinity
    authors: Record<string, number>;
    viewedCount: number;                 // posts seen this session
  };
  lastDecayAt: string;                   // ISO of last decay pass
  createdAt: string;
}
3.1 Time-weighted decay
Instead of a flat 0.9x per day, use an exponential decay with a 14-day half-life:

text
weight(t) = initial_weight * 0.5 ^ (days_since(t) / 14)
A like from yesterday ≈ 0.95

A like from two weeks ago ≈ 0.5

A like from three months ago ≈ 0.01

Run the decay pass on first app load each day, not on every read.

3.2 Session affinity
Reset profile.session on each cold start. Blend long-term and session-local during ranking:

text
effectiveAffinity = 0.5 * longTerm + 0.5 * session
Early-session signals matter disproportionately — the first 5–10 posts teach the model what this session wants, not what the user wanted last week.

3.3 Cold start
If profile.createdAt is within the last 60 seconds or totalSignals < 10:

Use cold_start_mode = true for the first ~20 posts.

Ranking ignores personalization; use trending + format diversity.

Blend in 3–5 onboarding topics the user selected during signup.

After the first 20 posts or first super-signal, transition to normal mode.

Without this, day-1 retention collapses — the 70% personalized bucket is empty.

4. Base Ranking Score
Recency is genuinely primary. Engagement nudges a post up within a freshness window, never above a newer post outside the boost range.

text
FRESHNESS_WINDOW = 72 hours

effectiveTime = createdAt
              + min(engagementBoost, MAX_BOOST)

engagementBoost = reactions * 10min
                + comments  * 20min
                + shares    * 30min

MAX_BOOST = 6 hours
Only posts with createdAt >= now - 72h are eligible for the main feed. Older posts surface via "From your history" carousels, not the main stream.

ts
const REACTION_BOOST_MS = 10 * 60 * 1000;
const COMMENT_BOOST_MS  = 20 * 60 * 1000;
const SHARE_BOOST_MS    = 30 * 60 * 1000;
const MAX_BOOST_MS      = 6 * 60 * 60 * 1000;
const FRESHNESS_MS      = 72 * 60 * 60 * 1000;

export const isFresh = (post: FeedPost, now = Date.now()) =>
  now - new Date(post.created_at).getTime() <= FRESHNESS_MS;

export const getPostRankScore = (post: FeedPost): number => {
  const createdAt = new Date(post.created_at).getTime();
  const boost =
    (post.reactions_count ?? 0) * REACTION_BOOST_MS +
    (post.comments_count  ?? 0) * COMMENT_BOOST_MS +
    (post.shares_count    ?? 0) * SHARE_BOOST_MS;
  return createdAt + Math.min(boost, MAX_BOOST_MS);
};

export const sortPostsByRecencyAndEngagement = (
  posts: FeedPost[],
  now = Date.now()
): FeedPost[] =>
  posts
    .filter((p) => isFresh(p, now))
    .sort((a, b) => getPostRankScore(b) - getPostRankScore(a));
5. Delivery Mix (70 / 20 / 10)
Each assembled page of the feed blends three buckets:

70% Personalized — posts matching top hashtags, preferred formats, high-affinity authors.

20% High-velocity trending — global posts with strongest engagement acceleration over the last 6–12 hours.

10% Discovery — brand-new posts with 0–2 likes, guaranteeing every creator reach.

5.1 Cold-start override
When cold_start_mode = true, the mix becomes:

20% trending

60% format-diverse (spread across video_reel, multi_photo, text_status, link_post)

20% discovery

Once 20 posts have been viewed or a super-signal fires, transition to the standard mix.

5.2 Bucket construction
Trending = velocity = (reactions + 2*comments + 3*shares) / hours_since_created, top decile.

Discovery = authors with < 50 total impressions in the last 7 days, random within pool.

Personalized = scored by affinity(hashtags) + affinity(format) + affinity(author).

6. Pacing & Safety Guards
Hard privacy gate — eligible only when privacy = 'public', is_deleted = false, and neither party has blocked the other.

Author spacing — at most 1 post per author within any 5-post window.

Topic diversity — no more than 3 posts sharing a top hashtag within any 10-post window.

Seen suppression — a post dwelled on for > 3s across two distinct sessions without interaction is suppressed for 48 hours.

Anti-spam pacing — a burst of posts from one account within a short window collapses to its strongest performer.

Moderation quarantine — reported or flagged posts are withheld from the global pool pending review.

Client-side signal integrity — dwell events are validated server-side on a sampled basis. Bots emitting uniform dwell times or impossible scroll velocities get their signals discarded.

7. Pagination Stability
Re-ranking happens over the accumulated set, not per page. Each loadMore dedupes against already-loaded ids before merging, and applies a stable sort keyed on first_seen_index so already-read posts don't reshuffle.

ts
const existingIds = new Set(currentPosts.map((p) => p.id));
const merged = [...currentPosts, ...incoming.filter((p) => !existingIds.has(p.id))]
  .map((p, idx) => ({ ...p, _firstSeenIndex: p._firstSeenIndex ?? idx }));

// Sort: read posts stay in place; unread posts ranked by score.
return merged.sort((a, b) => {
  if (a._firstSeenIndex != null && b._firstSeenIndex != null) {
    return a._firstSeenIndex - b._firstSeenIndex;
  }
  return getPostRankScore(b) - getPostRankScore(a);
});
7.1 "Caught up" state
When the pool is exhausted, render a You're all caught up card. Infinite scroll with no terminus hurts session-end sentiment and prevents natural exit.

8. Metrics
Tune weights only after you have baseline distributions. Primary metrics:

Metric	Why
Avg. session dwell	Overall engagement quality
D1 / D7 retention	Whether the mix is actually sticky
Scroll depth	How far users get before bouncing
Like + comment rate per 100 impressions	Explicit intent density
Share rate per 100 impressions	Strongest quality proxy
Report rate per 1000 impressions	Safety floor — must trend down
Author diversity in first 20 posts	Discovery health
Cold-start → engaged transition rate	Onboarding efficacy
Set thresholds before A/B testing. Without them you're tuning blind.

9. Implementation Blueprint
Piece	Location	Responsibility
useDwellTracker	src/hooks/useDwellTracker.ts	IntersectionObserver timers per post card; emits dwell/skip signals with confidence factor
affinityProfile	src/lib/affinityProfile.ts	Read/write/decay the local affinity vector; session management
feedRanking	src/lib/feedRanking.ts	getPostRankScore, sortPostsByRecencyAndEngagement, freshness filter
feedBuckets	src/lib/feedBuckets.ts	Affinity ranking, trending / discovery / format-diverse buckets, 70/20/10 mix
useFeed	src/hooks/useFeed.ts	Global public candidate query, bucket blending, dedupe + stable pagination
PostCardModern	src/components/PostCard/PostCardModern.tsx	Mounts dwell observer; reports micro-actions and reaction types
signalValidator	Edge function	Server-side sampling of dwell events to drop bot signals
9.1 Rollout order
v1 — Signal capture & base rank.

useDwellTracker + affinityProfile + feedRanking (freshness window, decay).

Silent to users — the feed still sorts by recency + engagement.

Ship for 2 weeks. Collect real dwell distributions.

v1.5 — Directional signals.

Add confidence factors, negative signals, reaction sentiment split.

Still no personalization in ranking.

v2 — Personalization & delivery mix.

Client-side affinity ranking, 70/20/10 blending, cold-start override, and dwell-based updates are implemented. Candidate sets use engagement counts to estimate trending velocity and low reaction counts as a discovery proxy. Global impression counts and time-series engagement velocity are not currently stored, so the spec's under-50-impressions discovery rule and true acceleration calculation remain future server-side work. Author/topic pacing and moderation quarantine also remain outstanding.

Retune weights against observed v1 distributions before expanding to server-side ranking.

v2.5 — Adversarial defense.

Server-side signal validation, moderation quarantine.

10. Open Questions
Privacy disclosure. Dwell tracking must be disclosed in the app's privacy policy. Confirm this is acceptable for your target markets.

Multi-device users. Client-side affinity is per-device. Decide whether to sync via Supabase (encrypted) or accept device-local learning.

Reaction-type availability. The sentiment split depends on the reaction picker exposing types. Confirm PostCardModern's reaction payload includes this.

Cold-start topic selection. Requires an onboarding screen change. Coordinate with the auth flow.

Server-side fallback. If local storage is cleared, the user re-enters cold start. Acceptable for v1, but consider a coarse server-side "last known topics" cache later.

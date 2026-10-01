# POST-UPP Feed Recommendation Architecture

> Status: **Specification / Not yet implemented**
> Scope: Global public broadcast feed ranking, dwell-time interest learning, and delivery mix.

---

## 1. Objective

POST-UPP is a global public broadcast wall: every public post is eligible for every user's feed, regardless of follow relationships. The goal of this architecture is to turn that global pool into an adaptive, personalized stream that learns what each user cares about through silent dwell time and explicit engagement, while preserving safety, diversity, and discovery for new creators.

Design constraints:
- No follower-based gating of candidates.
- Learning happens client-side first (low latency, privacy-friendly, no expensive server recomputation).
- Every creator receives guaranteed impressions.

---

## 2. Signal Capture (Dwell & Intent Ladder)

Signals are captured silently as the user scrolls. Each contributes a weight to the active post's author and topic affinities.

### Passive signals

| Signal | Condition | Weight |
| --- | --- | --- |
| Skip | `< 1.2s` in viewport | `-0.2` |
| Dwell / Read | `3.0s – 8.0s` in viewport | `+0.5` |
| Deep Dwell | `> 8.0s`, or video `> 60%` watched | `+1.2` |

### Micro-actions

| Signal | Weight |
| --- | --- |
| Expand comment drawer | `+1.5` |
| Carousel photo swipe | `+1.0` per slide |
| Author profile inspection | `+1.8` |

### Super-signals

| Signal | Weight |
| --- | --- |
| Share via DM | `+3.0` |
| Bookmark / Save | `+2.5` |
| Comment | `+2.0` |
| Like | `+1.0` |

Rationale: sharing a post privately is the strongest statement of value a user can make, far stronger than a like, which is often reflexive.

---

## 3. Local Affinity Vector

Stored in local storage under the key `postupp_affinity_profile`.

```ts
interface AffinityProfile {
  hashtags: Record<string, number>;      // topic score per hashtag
  formats: Record<PostFormat, number>;   // video_reel | multi_photo | text_status
  authors: Record<string, number>;       // author userId -> affinity multiplier
  lastDecayAt: string;                   // ISO date of last decay pass
}
```

- **Topic / hashtag affinities** — accumulated signal weight per hashtag.
- **Format affinity** — preference ratios across `video_reel`, `multi_photo`, `text_status`.
- **Author affinity** — boost multiplier for creators the user lingers on or messages.
- **Decay** — on first load each day, every score is multiplied by `0.9`. Interests fade rather than freeze, so the feed can follow a user's taste as it shifts.

---

## 4. Base Ranking Score

Before personalization, candidates are ordered by a virtual time offset: recency is primary, engagement nudges a post upward without ever letting an old post outrank a genuinely new one.

```
effectiveTime = createdAt
              + min(engagementBoost, maxBoost)

engagementBoost = reactions * 10min
                + comments  * 20min
                + shares    * 30min

maxBoost = 6 hours
```

```ts
const REACTION_BOOST_MS = 10 * 60 * 1000;
const COMMENT_BOOST_MS = 20 * 60 * 1000;
const SHARE_BOOST_MS = 30 * 60 * 1000;
const MAX_BOOST_MS = 6 * 60 * 60 * 1000;

export const getPostRankScore = (post: FeedPost): number => {
  const createdAt = new Date(post.created_at).getTime();
  const boost =
    (post.reactions_count ?? 0) * REACTION_BOOST_MS +
    (post.comments_count ?? 0) * COMMENT_BOOST_MS +
    (post.shares_count ?? 0) * SHARE_BOOST_MS;

  return createdAt + Math.min(boost, MAX_BOOST_MS);
};

export const sortPostsByRecencyAndEngagement = (posts: FeedPost[]): FeedPost[] =>
  [...posts].sort((a, b) => getPostRankScore(b) - getPostRankScore(a));
```

---

## 5. Delivery Mix (70 / 20 / 10)

Each assembled page of the feed blends three buckets:

1. **70% Personalized** — posts matching the user's top hashtags, preferred formats, and high-affinity authors.
2. **20% High-velocity trending** — global posts with the strongest engagement acceleration over the last 6–12 hours.
3. **10% Discovery / exploration** — brand-new posts with `0–2` likes, guaranteeing every creator reach regardless of follower count.

The exploration slot is what prevents the feed collapsing into a closed loop of the same creators and keeps the system learning.

---

## 6. Pacing & Safety Guards

- **Hard privacy gate** — a post is eligible only when `privacy = 'public'`, `is_deleted = false`, and neither party has blocked the other.
- **Author spacing** — at most 1 post per author within any 5-post window.
- **Seen suppression** — a post dwelled on for `> 3s` across two distinct sessions without interaction is suppressed for 48 hours.
- **Anti-spam pacing** — a burst of posts from one account within a short window is collapsed to its strongest performer.
- **Moderation quarantine** — reported or flagged posts are withheld from the global pool pending review.

---

## 7. Pagination Stability

Re-ranking happens over the accumulated set, not per page. Each `loadMore` dedupes against already-loaded ids before merging:

```ts
const existingIds = new Set(currentPosts.map((p) => p.id));
const merged = [...currentPosts, ...incoming.filter((p) => !existingIds.has(p.id))];
return sortPostsByRecencyAndEngagement(merged);
```

This prevents duplicates and visible reshuffling of already-read posts during scroll.

---

## 8. Implementation Blueprint

| Piece | Location | Responsibility |
| --- | --- | --- |
| `useDwellTracker` | `src/hooks/useDwellTracker.ts` | IntersectionObserver timers per post card; emits dwell/skip signals |
| `affinityProfile` | `src/lib/affinityProfile.ts` | Read/write/decay the local affinity vector |
| `feedRanking` | `src/lib/feedRanking.ts` | `getPostRankScore`, `sortPostsByRecencyAndEngagement`, personalization re-rank |
| `useFeed` | `src/hooks/useFeed.ts` | Global public candidate query, bucket blending, dedupe on `loadMore` |
| `PostCardModern` | `src/components/PostCard/PostCardModern.tsx` | Mounts the dwell observer, reports micro-actions |

Rollout order:
1. Signal capture (`useDwellTracker` + `affinityProfile`) — silent, no visible feed change.
2. Base ranking (`feedRanking` wired into `useFeed`).
3. Delivery mix and guards once there is enough local affinity data to be meaningful.

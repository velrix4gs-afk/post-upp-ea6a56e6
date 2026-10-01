// Base feed ranking per docs/FEED_ALGORITHM.md §4.
// Recency is primary; engagement nudges a post up within a freshness window,
// never above a newer post outside the boost range.

export interface FeedRankPost {
  id: string;
  created_at: string;
  reactions_count?: number | null;
  comments_count?: number | null;
  shares_count?: number | null;
}

const REACTION_BOOST_MS = 10 * 60 * 1000;
const COMMENT_BOOST_MS = 20 * 60 * 1000;
const SHARE_BOOST_MS = 30 * 60 * 1000;
const MAX_BOOST_MS = 6 * 60 * 60 * 1000;
const FRESHNESS_MS = 72 * 60 * 60 * 1000;

export const isFresh = (post: FeedRankPost, now = Date.now()) =>
  now - new Date(post.created_at).getTime() <= FRESHNESS_MS;

export const getPostRankScore = (post: FeedRankPost): number => {
  const createdAt = new Date(post.created_at).getTime();
  const boost =
    (post.reactions_count ?? 0) * REACTION_BOOST_MS +
    (post.comments_count ?? 0) * COMMENT_BOOST_MS +
    (post.shares_count ?? 0) * SHARE_BOOST_MS;
  return createdAt + Math.min(boost, MAX_BOOST_MS);
};

// Strict spec version: only fresh posts, ranked by score.
export const sortPostsByRecencyAndEngagement = <T extends FeedRankPost>(
  posts: T[],
  now = Date.now()
): T[] =>
  posts
    .filter((p) => isFresh(p, now))
    .sort((a, b) => getPostRankScore(b) - getPostRankScore(a));

// Non-destructive variant used by the live feed: fresh posts ranked by score
// first, older posts appended after in recency order, so small feeds never
// render empty just because everything is older than 72h.
export const rankFeedPosts = <T extends FeedRankPost>(
  posts: T[],
  now = Date.now()
): T[] => {
  const fresh: T[] = [];
  const stale: T[] = [];
  for (const p of posts) {
    (isFresh(p, now) ? fresh : stale).push(p);
  }
  fresh.sort((a, b) => getPostRankScore(b) - getPostRankScore(a));
  stale.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return [...fresh, ...stale];
};

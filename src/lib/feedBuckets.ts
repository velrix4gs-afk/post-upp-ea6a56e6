import {
  detectPostFormat,
  extractHashtags,
  getEffectiveAffinity,
  isColdStart,
  loadAffinityProfile,
  type AffinityProfile,
  type PostFormat,
} from '@/lib/affinityProfile';
import {
  getPostRankScore,
  isFresh,
  type FeedRankPost,
} from '@/lib/feedRanking';

export interface FeedBucketPost extends FeedRankPost {
  user_id: string;
  content?: string | null;
  media_url?: string | null;
  media_urls?: string[] | null;
  media_type?: string | null;
  reactions_count?: number | null;
  comments_count?: number | null;
  shares_count?: number | null;
}

const TRENDING_WINDOW_MS = 12 * 60 * 60 * 1000;
const STANDARD_PATTERN = ['personalized', 'personalized', 'personalized', 'personalized', 'personalized', 'personalized', 'personalized', 'trending', 'trending', 'discovery'] as const;
const COLD_START_PATTERN = ['format', 'format', 'format', 'trending', 'format', 'format', 'format', 'trending', 'discovery', 'discovery'] as const;

type BucketName = 'personalized' | 'trending' | 'discovery' | 'format';

const baseRank = <T extends FeedBucketPost>(posts: T[]) =>
  [...posts].sort((a, b) => getPostRankScore(b) - getPostRankScore(a));

const personalizedScore = <T extends FeedBucketPost>(
  post: T,
  profile: AffinityProfile,
  now: number,
) => {
  const affinity = getEffectiveAffinity({
    hashtags: extractHashtags(post.content || ''),
    authorId: post.user_id,
    format: detectPostFormat(post),
  }, profile);
  const recency = Math.max(0, 1 - (now - new Date(post.created_at).getTime()) / (72 * 60 * 60 * 1000));
  const engagement = Math.min(1, (getPostRankScore(post) - new Date(post.created_at).getTime()) / (6 * 60 * 60 * 1000));
  const normalizedAffinity = Math.tanh(affinity / 10);
  return normalizedAffinity * 0.65 + recency * 0.25 + engagement * 0.1;
};

const trendingScore = <T extends FeedBucketPost>(post: T, now: number) => {
  const ageHours = Math.max(0.25, (now - new Date(post.created_at).getTime()) / (60 * 60 * 1000));
  return ((post.reactions_count || 0) + 2 * (post.comments_count || 0) + 3 * (post.shares_count || 0)) / ageHours;
};

const pickFrom = <T extends FeedBucketPost>(
  bucket: T[],
  usedIds: Set<string>,
): T | undefined => {
  while (bucket.length > 0) {
    const post = bucket.shift()!;
    if (usedIds.has(post.id)) continue;
    usedIds.add(post.id);
    return post;
  }
  return undefined;
};

export const rankAndBlendFeedPosts = <T extends FeedBucketPost>(
  posts: T[],
  options: { now?: number; profile?: AffinityProfile } = {},
): T[] => {
  const now = options.now ?? Date.now();
  const profile = options.profile ?? loadAffinityProfile();
  const unique = [...new Map(posts.map((post) => [post.id, post])).values()];
  const fresh = unique.filter((post) => isFresh(post, now));
  const candidates = fresh.length > 0 ? fresh : unique;
  const coldStart = isColdStart(profile);
  const pattern: readonly BucketName[] = coldStart ? COLD_START_PATTERN : STANDARD_PATTERN;

  const personalized = [...candidates].sort(
    (a, b) => personalizedScore(b, profile, now) - personalizedScore(a, profile, now),
  );
  const trending = candidates
    .filter((post) => now - new Date(post.created_at).getTime() <= TRENDING_WINDOW_MS)
    .sort((a, b) => trendingScore(b, now) - trendingScore(a, now));
  const discovery = candidates
    .filter((post) => (post.reactions_count || 0) <= 2)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const formats: PostFormat[] = ['video_reel', 'multi_photo', 'text_status', 'link_post'];
  const formatGroups = formats.map((format) =>
    personalized.filter((post) => detectPostFormat(post) === format),
  );
  const formatDiverse: T[] = [];
  for (let index = 0; formatGroups.some((group) => group.length > 0); index += 1) {
    const group = formatGroups[index % formatGroups.length];
    const post = group.shift();
    if (post) formatDiverse.push(post);
  }
  const queues: Record<BucketName, T[]> = {
    personalized,
    trending,
    discovery,
    format: formatDiverse,
  };
  const fallback = baseRank(candidates);
  const usedIds = new Set<string>();
  const result: T[] = [];

  for (let index = 0; result.length < candidates.length; index += 1) {
    const bucket = queues[pattern[index % pattern.length]];
    const selected = pickFrom(bucket, usedIds) || pickFrom(fallback, usedIds);
    if (!selected) break;
    result.push(selected);
  }

  return result;
};

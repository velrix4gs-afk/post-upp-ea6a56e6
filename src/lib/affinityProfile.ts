// Local affinity vector per docs/FEED_ALGORITHM.md §2–§3.
// Stored in localStorage under `postupp_affinity_profile`. Learning is
// client-side first: low latency, privacy-friendly, no server recomputation.

export type PostFormat = 'video_reel' | 'multi_photo' | 'text_status' | 'link_post';
export type AffinityReactionType = 'love' | 'like' | 'care' | 'haha' | 'wow' | 'sad' | 'angry';

export interface AffinityProfile {
  version: 1;
  hashtags: Record<string, number>;
  formats: Record<PostFormat, number>;
  authors: Record<string, number>;
  mutedKeywords: string[];
  blockedAuthors: string[];
  hasSuperSignal: boolean;
  session: {
    startedAt: string;
    hashtags: Record<string, number>;
    authors: Record<string, number>;
    viewedCount: number;
    viewedPostIds: string[];
  };
  totalSignals: number;
  lastDecayAt: string;
  createdAt: string;
}

const STORAGE_KEY = 'postupp_affinity_profile';
const SESSION_KEY = 'postupp_affinity_session_active';
export const AFFINITY_PROFILE_UPDATED_EVENT = 'postupp-affinity-profile-updated';
const DECAY_HALF_LIFE_DAYS = 14;
const COLD_START_VIEW_THRESHOLD = 20;
const SUPER_SIGNAL_THRESHOLD = 2.5;

// Signal weights (§2)
export const SIGNAL_WEIGHTS = {
  skip: -0.2,
  dwell: 0.5,
  deepDwell: 1.2,
  videoCompletion: 1.0,
  videoRewatch: 2.5,
  commentExpand: 1.5,
  carouselSwipe: 1.0, // per slide, cap 3.0
  profileInspect: 1.8,
  shareDm: 3.0,
  bookmark: 2.5,
  comment: 2.0,
  followAuthor: 2.5,
  like: 1.0,
  notInterested: -3.0,
  hideTopic: -5.0,
  muteAuthor: -5.0,
  unfollowAuthor: -3.0,
} as const;

// Confidence factors for directionless dwell (§2.1)
const CONFIDENCE_NEUTRAL_DWELL = 0.4;
const CONFIDENCE_NEUTRAL_DEEP_DWELL = 0.5;
const CONFIDENCE_ENGAGED = 1.5;

// Reaction sentiment split (§2.5)
export const REACTION_WEIGHTS: Record<AffinityReactionType, number> = {
  love: 1.2,
  like: 1.0,
  care: 1.0,
  haha: 0.6,
  wow: 0.8,
  sad: 0.4,
  angry: -0.6,
};

const emptySession = () => ({
  startedAt: new Date().toISOString(),
  hashtags: {} as Record<string, number>,
  authors: {} as Record<string, number>,
  viewedCount: 0,
  viewedPostIds: [] as string[],
});

const createProfile = (): AffinityProfile => ({
  version: 1,
  hashtags: {},
  formats: { video_reel: 0, multi_photo: 0, text_status: 0, link_post: 0 },
  authors: {},
  mutedKeywords: [],
  blockedAuthors: [],
  hasSuperSignal: false,
  session: emptySession(),
  totalSignals: 0,
  lastDecayAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
});

export const loadAffinityProfile = (): AffinityProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createProfile();
    const parsed = JSON.parse(raw) as AffinityProfile;
    if (parsed.version !== 1) return createProfile();
    const fallback = createProfile();
    return {
      ...fallback,
      ...parsed,
      formats: { ...fallback.formats, ...parsed.formats },
      session: {
        ...fallback.session,
        ...parsed.session,
        viewedPostIds: parsed.session?.viewedPostIds || [],
      },
    };
  } catch {
    return createProfile();
  }
};

export const saveAffinityProfile = (profile: AffinityProfile, notify = true): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    if (notify && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AFFINITY_PROFILE_UPDATED_EVENT));
    }
  } catch {
    /* storage full or unavailable — learning is best-effort */
  }
};

const decayMap = (map: Record<string, number>, factor: number) => {
  for (const key of Object.keys(map)) {
    map[key] *= factor;
    if (Math.abs(map[key]) < 0.01) delete map[key];
  }
};

// Exponential decay with a 14-day half-life, run at most once per day (§3.1).
export const runDailyDecay = (profile: AffinityProfile): AffinityProfile => {
  const last = new Date(profile.lastDecayAt).getTime();
  const now = Date.now();
  const days = (now - last) / (24 * 60 * 60 * 1000);
  if (days < 1) return profile;
  const factor = Math.pow(0.5, days / DECAY_HALF_LIFE_DAYS);
  decayMap(profile.hashtags, factor);
  decayMap(profile.authors, factor);
  for (const key of Object.keys(profile.formats) as PostFormat[]) {
    profile.formats[key] *= factor;
  }
  profile.lastDecayAt = new Date().toISOString();
  return profile;
};

// Reset session-local affinity on each cold start (§3.2).
export const startAffinitySession = (): AffinityProfile => {
  const profile = runDailyDecay(loadAffinityProfile());
  const alreadyActive = sessionStorage.getItem(SESSION_KEY) === '1';
  if (!alreadyActive) {
    profile.session = emptySession();
    sessionStorage.setItem(SESSION_KEY, '1');
  }
  saveAffinityProfile(profile, false);
  return profile;
};

export interface SignalTarget {
  hashtags?: string[];
  authorId?: string;
  format?: PostFormat;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Record a weighted signal against the post's topics, author and format.
export const recordSignal = (
  weight: number,
  target: SignalTarget,
  confidence = 1.0
): void => {
  if (!weight) return;
  const profile = loadAffinityProfile();
  const effective = clamp(weight * confidence, -5, 5);

  for (const tag of target.hashtags || []) {
    const key = tag.toLowerCase();
    profile.hashtags[key] = (profile.hashtags[key] || 0) + effective;
    profile.session.hashtags[key] = (profile.session.hashtags[key] || 0) + effective;
  }
  if (target.authorId) {
    profile.authors[target.authorId] = (profile.authors[target.authorId] || 0) + effective;
    profile.session.authors[target.authorId] =
      (profile.session.authors[target.authorId] || 0) + effective;
  }
  if (target.format) {
    profile.formats[target.format] = (profile.formats[target.format] || 0) + effective;
  }
  profile.totalSignals += 1;
  if (Math.abs(effective) >= SUPER_SIGNAL_THRESHOLD) {
    profile.hasSuperSignal = true;
  }
  saveAffinityProfile(profile);
};

// Dwell signals are directionless — confidence depends on whether the user
// followed up with an explicit action (§2.1).
export const recordDwellSignal = (
  durationMs: number,
  engaged: boolean,
  target: SignalTarget
): void => {
  if (durationMs < 1200) {
    recordSignal(SIGNAL_WEIGHTS.skip, target);
    return;
  }
  if (durationMs < 3000) return; // dead zone: neither skip nor dwell
  if (durationMs <= 8000) {
    recordSignal(
      SIGNAL_WEIGHTS.dwell,
      target,
      engaged ? CONFIDENCE_ENGAGED : CONFIDENCE_NEUTRAL_DWELL
    );
    return;
  }
  recordSignal(
    SIGNAL_WEIGHTS.deepDwell,
    target,
    engaged ? CONFIDENCE_ENGAGED : CONFIDENCE_NEUTRAL_DEEP_DWELL
  );
};

export const recordReactionSignal = (
  type: AffinityReactionType,
  target: SignalTarget
): void => {
  recordSignal(REACTION_WEIGHTS[type] ?? SIGNAL_WEIGHTS.like, target);
};

export const markPostViewed = (postId?: string): void => {
  const profile = loadAffinityProfile();
  if (postId && profile.session.viewedPostIds.includes(postId)) return;
  if (postId) profile.session.viewedPostIds.push(postId);
  profile.session.viewedCount += 1;
  saveAffinityProfile(profile, false);
};

// Cold start (§3.3): personalization stays off until the profile has enough
// signal or the session has seen enough posts.
export const isColdStart = (profile?: AffinityProfile): boolean => {
  const p = profile || loadAffinityProfile();
  return !p.hasSuperSignal && p.session.viewedCount < COLD_START_VIEW_THRESHOLD;
};

// Blended affinity for ranking (§3.2): 0.5 * longTerm + 0.5 * session.
export const getEffectiveAffinity = (
  target: SignalTarget,
  profile?: AffinityProfile
): number => {
  const p = profile || loadAffinityProfile();
  let score = 0;
  for (const tag of target.hashtags || []) {
    const key = tag.toLowerCase();
    score += 0.5 * (p.hashtags[key] || 0) + 0.5 * (p.session.hashtags[key] || 0);
  }
  if (target.authorId) {
    score +=
      0.5 * (p.authors[target.authorId] || 0) +
      0.5 * (p.session.authors[target.authorId] || 0);
  }
  if (target.format) {
    score += p.formats[target.format] || 0;
  }
  return score;
};

export const extractHashtags = (content: string): string[] => {
  const matches = content.match(/#(\w+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
};

export const detectPostFormat = (post: {
  content?: string | null;
  media_url?: string | null;
  media_urls?: string[] | null;
  media_type?: string | null;
}): PostFormat => {
  const urls = post.media_urls && post.media_urls.length > 0
    ? post.media_urls
    : post.media_url
      ? [post.media_url]
      : [];
  const isVideo = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || u.includes('/video/');
  if (urls.some(isVideo) || post.media_type === 'video') return 'video_reel';
  if (urls.length > 1 || post.media_type === 'multiple') return 'multi_photo';
  if (urls.length === 1) return 'multi_photo';
  if (post.content && /(https?:\/\/[^\s]+)/.test(post.content)) return 'link_post';
  return 'text_status';
};

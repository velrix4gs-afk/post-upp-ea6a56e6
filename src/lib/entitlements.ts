/**
 * What each plan actually unlocks. These mirror the feature lists shown on the Premium page
 * (premium_plans.features), so what users pay for is what the app enforces.
 */
export type PlanId = 'free' | 'basic' | 'pro' | 'elite';

export interface Entitlements {
  plan: PlanId;
  photoMB: number;          // max photo size in a post / chat
  videoMB: number;          // max video size in a post
  storyPhotoMB: number;     // max photo size in a Showcase
  storyVideoMB: number;     // max video size in a Showcase
  storyHours: number;       // how long a Showcase item stays up
  chatWallpaper: boolean;
  chatTheme: boolean;
}

export const PLAN_ENTITLEMENTS: Record<PlanId, Entitlements> = {
  free:  { plan: 'free',  photoMB: 10,  videoMB: 100,  storyPhotoMB: 50,  storyVideoMB: 50,   storyHours: 24, chatWallpaper: false, chatTheme: false },
  basic: { plan: 'basic', photoMB: 25,  videoMB: 150,  storyPhotoMB: 50,  storyVideoMB: 150,  storyHours: 24, chatWallpaper: true,  chatTheme: false },
  pro:   { plan: 'pro',   photoMB: 50,  videoMB: 500,  storyPhotoMB: 50,  storyVideoMB: 500,  storyHours: 48, chatWallpaper: true,  chatTheme: true },
  elite: { plan: 'elite', photoMB: 100, videoMB: 2048, storyPhotoMB: 100, storyVideoMB: 2048, storyHours: 72, chatWallpaper: true,  chatTheme: true },
};

export const normalizePlan = (planId?: string | null): PlanId =>
  planId === 'basic' || planId === 'pro' || planId === 'elite' ? planId : 'free';

export const formatMB = (mb: number) => (mb >= 1024 ? `${mb / 1024}GB` : `${mb}MB`);

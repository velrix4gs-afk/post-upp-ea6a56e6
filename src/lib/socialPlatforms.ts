export interface SocialPlatform {
  key: string;
  label: string;
  domain: string;
  placeholder: string;
}

// Extra platforms beyond Instagram, X and TikTok. Values are saved in
// profiles.social_links under these keys.
export const EXTRA_SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'youtube', label: 'YouTube', domain: 'youtube.com', placeholder: 'youtube.com/@channel' },
  { key: 'facebook', label: 'Facebook', domain: 'facebook.com', placeholder: 'facebook.com/username' },
  { key: 'linkedin', label: 'LinkedIn', domain: 'linkedin.com/in', placeholder: 'linkedin.com/in/username' },
  { key: 'snapchat', label: 'Snapchat', domain: 'snapchat.com/add', placeholder: 'snapchat.com/add/username' },
  { key: 'threads', label: 'Threads', domain: 'threads.net', placeholder: 'threads.net/@username' },
  { key: 'twitch', label: 'Twitch', domain: 'twitch.tv', placeholder: 'twitch.tv/username' },
  { key: 'github', label: 'GitHub', domain: 'github.com', placeholder: 'github.com/username' },
  { key: 'discord', label: 'Discord', domain: 'discord.gg', placeholder: 'discord.gg/invite' },
];

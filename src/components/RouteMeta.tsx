import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface PageMeta {
  title: string;
  description: string;
}

const SITE_NAME = 'POST UPP';
const DEFAULT_DESCRIPTION =
  'Join POST UPP to connect with friends, share moments, and discover communities with real-time messaging, stories, and more.';

const STATIC_META: Record<string, PageMeta> = {
  '/': { title: `${SITE_NAME} - Connect with Friends Around the World`, description: DEFAULT_DESCRIPTION },
  '/signin': { title: `Sign In | ${SITE_NAME}`, description: 'Sign in to POST UPP to catch up with friends, messages, stories, and your community feed.' },
  '/signup': { title: `Create Your Account | ${SITE_NAME}`, description: 'Create a free POST UPP account to share posts, chat in real time, and discover new communities.' },
  '/forgot-password': { title: `Reset Your Password | ${SITE_NAME}`, description: 'Recover access to your POST UPP account with a secure password reset.' },
  '/feed': { title: `Feed | ${SITE_NAME}`, description: 'See the latest posts from the POST UPP community.' },
  '/explore': { title: `Explore | ${SITE_NAME}`, description: 'Discover trending posts, people, and communities on POST UPP.' },
  '/search': { title: `Search | ${SITE_NAME}`, description: 'Search people, posts, and hashtags on POST UPP.' },
  '/messages': { title: `Messages | ${SITE_NAME}`, description: 'Chat with your friends in real time on POST UPP.' },
  '/friends': { title: `Friends | ${SITE_NAME}`, description: 'Manage your friends and connections on POST UPP.' },
  '/bookmarks': { title: `Bookmarks | ${SITE_NAME}`, description: 'Your saved posts on POST UPP.' },
  '/settings': { title: `Settings | ${SITE_NAME}`, description: 'Manage your POST UPP account, privacy, and appearance.' },
  '/premium': { title: `Premium | ${SITE_NAME}`, description: 'Unlock verification and premium features on POST UPP.' },
  '/pages': { title: `Pages | ${SITE_NAME}`, description: 'Browse brand and creator pages on POST UPP.' },
  '/help-support': { title: `Help & Support | ${SITE_NAME}`, description: 'Get help with your POST UPP account.' },
};

const getMeta = (pathname: string): PageMeta => {
  if (STATIC_META[pathname]) return STATIC_META[pathname];
  if (pathname.startsWith('/profile/')) return { title: `Profile | ${SITE_NAME}`, description: 'View this profile on POST UPP.' };
  if (pathname.startsWith('/post/')) return { title: `Post | ${SITE_NAME}`, description: 'View this post on POST UPP.' };
  if (pathname.startsWith('/hashtag/')) {
    const tag = decodeURIComponent(pathname.split('/')[2] || '');
    return { title: `#${tag} | ${SITE_NAME}`, description: `Posts tagged #${tag} on POST UPP.` };
  }
  if (pathname.startsWith('/page/')) return { title: `Page | ${SITE_NAME}`, description: 'View this page on POST UPP.' };
  return { title: SITE_NAME, description: DEFAULT_DESCRIPTION };
};

export const RouteMeta = () => {
  const { pathname } = useLocation();
  const meta = getMeta(pathname);

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={pathname} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={pathname} />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
    </Helmet>
  );
};

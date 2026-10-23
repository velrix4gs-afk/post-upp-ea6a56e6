// Serves a tiny HTML page with OpenGraph / Twitter tags to link-preview crawlers
// (WhatsApp, Facebook, X, Slack, Telegram, iMessage...). Real users never hit this:
// vercel.json only rewrites /profile/:handle here when the User-Agent is a known crawler.
const SUPABASE_URL = 'https://ccyyxkjpgebjnstevgkw.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeXl4a2pwZ2Viam5zdGV2Z2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3ODk0ODMsImV4cCI6MjA3NDM2NTQ4M30.u1lTe8ZgbRj6R2TJ1_gvEGvG1EHKD4ytId8IDjojbVI';
const SITE = 'https://post-upp.vercel.app';
const FALLBACK_IMAGE = 'https://storage.googleapis.com/gpt-engineer-file-uploads/2MLSQV2FhYTzyxqbVrLGlHwsMtU2/social-images/social-1760360857842-POST-UPP.jpg';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadCard(handle) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_profile_share_card`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_handle: handle }),
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) ? rows[0] || null : rows;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const handle = String(req.query.handle || '').replace(/^@/, '').slice(0, 64);
  const url = `${SITE}/profile/${encodeURIComponent(handle)}`;
  const card = handle ? await loadCard(handle) : null; // null for private / missing profiles → generic POST-UPP card

  let title = 'POST UP - Connect with Friends Around the World';
  let description = 'Join POST UP to share moments and chat with friends.';
  let image = FALLBACK_IMAGE;

  if (card) {
    title = `${card.display_name || card.username} (@${card.username}) on POST UP`;
    const stats = `${card.follower_count ?? 0} followers · ${card.post_count ?? 0} posts`;
    description = card.bio ? `${stats} — ${String(card.bio).slice(0, 140)}` : stats;
    if (card.avatar_url) image = card.avatar_url;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.status(200).send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="POST UPP">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="${card && card.avatar_url ? 'summary' : 'summary_large_image'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(url)}">
</head><body><a href="${esc(url)}">${esc(title)}</a></body></html>`);
}

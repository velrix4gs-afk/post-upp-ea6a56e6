/** Shared contacts travel as a small JSON envelope so they render as a contact card (name, @username, actions). */
export interface SharedContact {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}
export interface ContactShare {
  kind: 'contact_share';
  contacts: SharedContact[];
}

export const buildContactShare = (contacts: SharedContact[]): string =>
  JSON.stringify({ kind: 'contact_share', contacts } satisfies ContactShare);

export const parseContactShare = (content: unknown): ContactShare | null => {
  if (typeof content !== 'string') return null;
  const t = content.trim();
  if (!t.startsWith('{') || !t.includes('"contact_share"')) return null;
  try {
    const p = JSON.parse(t);
    if (p?.kind === 'contact_share' && Array.isArray(p.contacts) && p.contacts.length) return p as ContactShare;
  } catch { /* not a contact share */ }
  return null;
};

export const contactSharePreview = (content: unknown): string | null => {
  const c = parseContactShare(content);
  if (!c) return null;
  return c.contacts.length === 1 ? `👤 @${c.contacts[0].username}` : `👤 ${c.contacts.length} contacts`;
};

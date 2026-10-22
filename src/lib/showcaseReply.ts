/**
 * Replies/reactions to a Showcase item are sent as a normal chat message whose
 * content is a small JSON envelope, so the recipient sees the actual
 * photo/video thumbnail and caption instead of a generic "(Showcase item)".
 * Plain-text legacy replies still render as text.
 */
export interface ShowcaseReply {
  kind: 'showcase_reply';
  text: string;
  caption?: string;
  mediaUrl?: string;
  mediaType?: string;
  storyId?: string;
  ownerName?: string;
}

export const buildShowcaseReply = (
  story: { id?: string; content?: string | null; media_url?: string | null; media_type?: string | null; profiles?: { display_name?: string | null; username?: string | null } | null },
  text: string,
): string => {
  const payload: ShowcaseReply = {
    kind: 'showcase_reply',
    text,
    caption: story.content?.trim().slice(0, 140) || undefined,
    mediaUrl: story.media_url || undefined,
    mediaType: story.media_type || undefined,
    storyId: story.id,
    ownerName: story.profiles?.display_name || story.profiles?.username || undefined,
  };
  return JSON.stringify(payload);
};

export const parseShowcaseReply = (content: unknown): ShowcaseReply | null => {
  if (typeof content !== 'string') return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.includes('"showcase_reply"')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.kind === 'showcase_reply' && typeof parsed.text === 'string') return parsed as ShowcaseReply;
  } catch {
    /* not a showcase reply */
  }
  return null;
};

/** One-line text for chat-list previews and notifications. */
export const showcaseReplyPreview = (content: unknown): string | null => {
  const reply = parseShowcaseReply(content);
  if (!reply) return null;
  return reply.text === '❤️' ? '❤️ Reacted to your Showcase' : `↩︎ Showcase: ${reply.text}`;
};

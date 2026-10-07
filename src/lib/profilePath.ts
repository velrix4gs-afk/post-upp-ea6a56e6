export function profilePath(user: any): string {
  if (user?.username) return `/profile/${user.username}`;
  return `/profile/${user?.id}`;
}

/**
 * Canonical profile link for a person you only have an id for, when a
 * username may also be on hand.
 *
 * Profiles are addressable by either key (see ProfilePage's uuid check), but
 * a username is the stable, human-readable one — it survives re-signup and
 * looks right when shared. Prefer it whenever it is available, and fall back
 * to the id rather than emitting `/profile/undefined`.
 */
export function profilePathFor(id?: string | null, username?: string | null): string {
  const handle = username?.trim();
  if (handle) return `/profile/${handle}`;
  return id ? `/profile/${id}` : '/';
}

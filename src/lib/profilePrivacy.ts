/** Fields that must never leave the owner's session. */
export const OWNER_ONLY_PROFILE_FIELDS = ['phone', 'birth_date', 'gender'] as const;

export type OwnerOnlyProfileField = (typeof OWNER_ONLY_PROFILE_FIELDS)[number];

/** Strip phone, birth date, and gender from a profile payload. */
export function stripOwnerOnlyProfileFields<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row };
  for (const key of OWNER_ONLY_PROFILE_FIELDS) {
    delete (next as Record<string, unknown>)[key];
  }
  return next;
}

export function isProfileOwner(viewerId: string | undefined, profileId: string | undefined): boolean {
  return !!viewerId && !!profileId && viewerId === profileId;
}

/**
 * Non-friends / non-followers of a private account should still see a
 * public identity card (photo, name, username) so they can follow.
 * They must not see posts, bio details, or owner-only PII.
 */
export function canViewFullProfile(opts: {
  isOwnProfile: boolean;
  isPrivate?: boolean | null;
  isApprovedFollower?: boolean;
  canViewFull?: boolean | null;
}): boolean {
  if (opts.isOwnProfile) return true;
  if (typeof opts.canViewFull === 'boolean') return opts.canViewFull;
  if (!opts.isPrivate) return true;
  return !!opts.isApprovedFollower;
}

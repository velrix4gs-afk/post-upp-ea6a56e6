export function profilePath(user: any): string {
  if (user?.username) return `/profile/${user.username}`;
  return user?.id ? `/profile/${user.id}` : '/';
}

export function profilePathFor(idOrUser?: any, username?: string | null): string {
  if (idOrUser && typeof idOrUser === 'object') {
    return profilePath(idOrUser);
  }
  const handle = username?.trim();
  if (handle) return `/profile/${handle}`;
  return idOrUser ? `/profile/${idOrUser}` : '/';
}

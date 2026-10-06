export function profilePath(user: any): string {
  if (user?.username) return `/profile/${user.username}`;
  return `/profile/${user?.id}`;
}

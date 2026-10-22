/** Where tapping a notification should take the user. Shared by the panel and the in-app banner. */
export const getNotificationActorId = (n: any): string | undefined =>
  n?.data?.actor_id || n?.data?.follower_id || n?.data?.requester_id || n?.data?.from_user_id || n?.data?.user_id;

export const getNotificationPath = (n: any): string | null => {
  const data = n?.data || {};
  const chatId = data.chat_id;
  if (chatId && (n.type === 'message' || n.type === 'voice_call' || n.type === 'video_call')) {
    return `/messages?chat=${chatId}`;
  }
  if (data.post_id) {
    const hash = data.comment_id ? `#comment-${data.comment_id}` : n.type === 'comment' ? '#comments' : '';
    return `/post/${data.post_id}${hash}`;
  }
  const actor = getNotificationActorId(n);
  return actor ? `/profile/${actor}` : null;
};

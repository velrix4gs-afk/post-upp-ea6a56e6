import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { ThreadedComment as ThreadedCommentType } from '@/hooks/useThreadedComments';
import { cn } from '@/lib/utils';
import { VerificationBadge } from './premium/VerificationBadge';
import { ProfileHoverCard } from './ProfileHoverCard';

interface ThreadedCommentProps {
  comment: ThreadedCommentType;
  onReply: (content: string, parentId: string) => void;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string) => void;
  isCommentLiked: (commentId: string) => boolean;
  depth?: number;
}

export const ThreadedComment = ({
  comment,
  onReply,
  onDelete,
  onLike,
  isCommentLiked,
  depth = 0
}: ThreadedCommentProps) => {
  const { user } = useAuth();
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(false);

  const isLiked = isCommentLiked(comment.id);
  const maxDepth = 3;
  const replyCount = comment.replies?.length || 0;

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(replyText, comment.id);
      setReplyText('');
      setShowReplyBox(false);
      setShowReplies(true);
    }
  };

  const handleShowReplyBox = () => {
    if (!showReplyBox) {
      const mention = comment.user?.display_name ? `@${comment.user.display_name.replace(/\s+/g, '')} ` : '';
      setReplyText(mention);
    }
    setShowReplyBox(!showReplyBox);
  };

  return (
    <div id={`comment-${comment.id}`} className={cn("flex gap-2 scroll-mt-24 rounded-lg transition-colors", depth > 0 && depth <= maxDepth && "ml-8")}>
      <ProfileHoverCard userId={comment.user_id} disabled={!comment.user_id}>
        <Avatar className="h-8 w-8 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarImage src={comment.user?.avatar_url} />
          <AvatarFallback>
            {comment.user?.display_name?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>
      </ProfileHoverCard>
      <div className="flex-1 min-w-0">
        <div className="bg-muted rounded-lg p-3">
          <div className="flex items-center justify-between">
            <ProfileHoverCard userId={comment.user_id} disabled={!comment.user_id}>
              <div className="flex items-center gap-1 cursor-pointer hover:underline">
                <p className="font-semibold text-sm">
                  {comment.user?.display_name || 'Unknown'}
                </p>
                <VerificationBadge 
                  isVerified={comment.user?.is_verified}
                  verificationType={comment.user?.verification_type}
                />
              </div>
            </ProfileHoverCard>
            {user?.id === comment.user_id && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          <p className="text-sm mt-1 break-words">{comment.content}</p>
        </div>
        
        <div className="flex items-center gap-3 mt-1 ml-3">
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </p>
          
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-xs hover:text-pink-500",
              isLiked && "text-pink-500"
            )}
            onClick={() => onLike(comment.id)}
          >
            <Heart className={cn("h-3 w-3 mr-1", isLiked && "fill-current")} />
            {comment.likes_count > 0 && comment.likes_count}
          </Button>

          <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs hover:text-blue-500"
              onClick={handleShowReplyBox}
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              Reply
            </Button>
        </div>

        {showReplyBox && (
          <div className="mt-2 ml-3">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="min-h-[60px] text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleReply();
                }
              }}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowReplyBox(false);
                  setReplyText('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleReply}
                disabled={!replyText.trim()}
              >
                Reply
              </Button>
            </div>
          </div>
        )}

        {/* Collapsible replies */}
        {replyCount > 0 && !showReplies && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-3 text-xs text-primary hover:text-primary/80 mt-1 ml-3"
            onClick={() => setShowReplies(true)}
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            View {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </Button>
        )}

        {replyCount > 0 && showReplies && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground mt-1 ml-3"
              onClick={() => setShowReplies(false)}
            >
              <ChevronUp className="h-3 w-3 mr-1" />
              Hide replies
            </Button>
            <div className="mt-2 space-y-3">
              {comment.replies!.map((reply) => (
                <ThreadedComment
                  key={reply.id}
                  comment={reply}
                  onReply={onReply}
                  onDelete={onDelete}
                  onLike={onLike}
                  isCommentLiked={isCommentLiked}
                  depth={depth + 1}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

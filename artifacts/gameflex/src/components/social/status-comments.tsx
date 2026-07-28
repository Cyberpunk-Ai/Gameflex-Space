import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Lock } from 'lucide-react';
import { encryptMessage, decryptMessage } from '@/lib/encryption';
import { useToast } from '@/hooks/use-toast';

interface StatusCommentsProps {
  statusId: string;
  commentsCount: number;
}

interface CommentProfile {
  username: string;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  status_id: string;
  user_id: string;
  content: string;
  is_encrypted: boolean;
  created_at: string;
  profile?: CommentProfile;
}

interface StatusCommentsPropsExtended extends StatusCommentsProps {
  open?: boolean;
}

export function StatusComments({ statusId, commentsCount, open = false }: StatusCommentsPropsExtended) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState('');
  const [isExpanded, setIsExpanded] = useState(open);

  useEffect(() => {
    if (open) setIsExpanded(true);
  }, [open]);
  const [decryptedComments, setDecryptedComments] = useState<Map<string, string>>(new Map());

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['status-comments', statusId],
    queryFn: async () => {
      const { data } = await supabase
        .from('status_comments')
        .select('*')
        .eq('status_id', statusId)
        .order('created_at', { ascending: true });

      if (!data) return [] as Comment[];

      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map<string, CommentProfile>(
        (profiles ?? []).map((p) => [p.user_id, { username: p.username, avatar_url: p.avatar_url }])
      );

      return data.map((c) => ({
        ...c,
        profile: profileMap.get(c.user_id)
      })) as Comment[];
    },
    enabled: isExpanded
  });

  useEffect(() => {
    async function decryptComments() {
      const decrypted = new Map<string, string>();
      for (const comment of comments) {
        if (comment.is_encrypted) {
          try {
            decrypted.set(comment.id, await decryptMessage(comment.content));
          } catch {
            decrypted.set(comment.id, comment.content);
          }
        } else {
          decrypted.set(comment.id, comment.content);
        }
      }
      setDecryptedComments(decrypted);
    }
    if (comments.length > 0) {
      decryptComments();
    }
  }, [comments]);

  useEffect(() => {
    if (!isExpanded) return;
    const channel = supabase
      .channel(`comments-${statusId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'status_comments',
          filter: `status_id=eq.${statusId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['status-comments', statusId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusId, isExpanded, queryClient]);

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Not authenticated');

      const encryptedContent = await encryptMessage(content);
      const { error } = await supabase.from('status_comments').insert({
        status_id: statusId,
        user_id: user.id,
        content: encryptedContent,
        is_encrypted: true
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['status-comments', statusId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  return (
    <div className="mt-1">
      {commentsCount > 0 && !isExpanded && (
        <button 
          onClick={() => setIsExpanded(true)}
          className="text-[14px] text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer"
        >
          View all {commentsCount} comments
        </button>
      )}

      {isExpanded && (
        <div className="mt-1 space-y-1">
          {isLoading ? (
            <div className="py-2 text-[14px] text-muted-foreground">Loading comments...</div>
          ) : (
            <div className="space-y-1">
              {comments.map((comment) => (
                <div key={comment.id} className="text-[14px] leading-[18px] group flex items-start justify-between">
                  <div>
                    <span className="font-bold mr-2 tracking-tight">{comment.profile?.username ?? 'Unknown'}</span>
                    <span>{decryptedComments.get(comment.id) ?? '...'}</span>
                  </div>
                  {comment.is_encrypted && <Lock className="h-3 w-3 text-muted-foreground opacity-50 shrink-0 mt-0.5 ml-2" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {user && (
        <form onSubmit={handleSubmit} className="mt-2 flex items-center relative">
          <Avatar className="h-7 w-7 mr-3 shrink-0">
            <AvatarImage src={user.user_metadata?.avatar_url ?? ''} />
            <AvatarFallback className="bg-secondary text-[10px]">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <input
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground pr-10"
          />
          {newComment.trim() && (
            <button 
              type="submit" 
              disabled={addCommentMutation.isPending}
              className="absolute right-0 text-primary text-[14px] font-bold hover:text-foreground transition-colors disabled:opacity-50"
            >
              Post
            </button>
          )}
        </form>
      )}
    </div>
  );
}
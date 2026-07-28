// @ts-nocheck
import { useParams, Link } from '@/lib/router-compat';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SocialLayout } from '@/components/social/social-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusComments } from '@/components/social/status-comments';
import { Heart, Eye, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PostDetail() {
  const { id } = useParams();
  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: async () => {
      const { data } = await supabase.from('user_statuses').select('*').eq('id', id).maybeSingle();
      if (!data) return null;
      const { data: profile } = await supabase.from('profiles').select('user_id, username, avatar_url').eq('user_id', data.user_id).maybeSingle();
      return { ...data, profile };
    },
  });

  if (isLoading) return <SocialLayout title="Post"><p className="text-center py-16 text-muted-foreground">Loading...</p></SocialLayout>;
  if (!post) return <SocialLayout title="Post not found"><Link to="/social" className="text-primary text-sm flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Back to feed</Link></SocialLayout>;

  return (
    <SocialLayout>
      <Link to="/social" className="text-sm text-muted-foreground flex items-center gap-1 mb-4 hover:text-primary"><ArrowLeft className="h-4 w-4" />Back</Link>
      <article className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <Link to={`/player/${post.user_id}`}>
            <Avatar className="h-11 w-11"><AvatarImage src={post.profile?.avatar_url} /><AvatarFallback>{post.profile?.username?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
          </Link>
          <div>
            <Link to={`/player/${post.user_id}`} className="font-medium hover:text-primary">{post.profile?.username}</Link>
            <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</div>
          </div>
        </div>
        {post.content && <p className="px-4 pb-3 whitespace-pre-wrap">{post.content}</p>}
        {post.media_url && (
          <div className="bg-black">
            {post.media_type === 'video'
              ? <video src={post.media_url} controls className="w-full max-h-[600px]" />
              : <img loading="lazy" decoding="async" src={post.media_url} className="w-full max-h-[600px] object-contain" />}
          </div>
        )}
        <div className="p-4 flex items-center gap-4 text-sm border-t border-border/50">
          <span className="flex items-center gap-1"><Heart className="h-4 w-4" />{post.likes_count ?? 0}</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Eye className="h-4 w-4" />{post.views_count ?? 0}</span>
        </div>
        <div className="px-4 pb-4">
          <StatusComments statusId={post.id} commentsCount={post.comments_count ?? 0} />
        </div>
      </article>
    </SocialLayout>
  );
}
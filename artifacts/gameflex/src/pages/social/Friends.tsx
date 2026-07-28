import { useQuery } from '@tanstack/react-query';
import { Link } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { SocialLayout } from '@/components/social/social-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FollowButton } from '@/components/social/follow-button';
import { Users } from 'lucide-react';

interface Profile {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

export default function Friends() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['friends', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: following }, { data: followers }] = await Promise.all([
        supabase.from('user_follows').select('following_id').eq('follower_id', user!.id),
        supabase.from('user_follows').select('follower_id').eq('following_id', user!.id),
      ]);
      const ids = [...new Set([
        ...(following ?? []).map((f) => f.following_id),
        ...(followers ?? []).map((f) => f.follower_id),
      ])];
      if (!ids.length) return { following: [] as Profile[], followers: [] as Profile[], suggestions: [] as Profile[] };
      const { data: profs } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', ids);
      const map = new Map<string, Profile>((profs ?? []).map((p) => [p.user_id, p as Profile]));
      const { data: suggestions } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .not('user_id', 'in', '(' + [user!.id, ...ids].join(',') + ')')
        .limit(6);
      return {
        following: (following ?? []).map((f) => map.get(f.following_id)).filter((p): p is Profile => Boolean(p)),
        followers: (followers ?? []).map((f) => map.get(f.follower_id)).filter((p): p is Profile => Boolean(p)),
        suggestions: (suggestions ?? []) as Profile[],
      };
    },
  });

  if (!user) return <SocialLayout title="Friends"><p className="text-center text-muted-foreground py-16">Sign in to manage your friends.</p></SocialLayout>;

  return (
    <SocialLayout title="Friends" subtitle="Your social graph">
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Panel title={`Following (${data?.following.length ?? 0})`} items={data?.following ?? []} />
        <Panel title={`Followers (${data?.followers.length ?? 0})`} items={data?.followers ?? []} />
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <h2 className="font-display font-bold text-sm mb-3 flex items-center gap-2"><Users className="h-4 w-4" />Suggested players</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(data?.suggestions ?? []).map((p) => (
            <div key={p.user_id} className="flex items-center gap-2 p-2 rounded bg-secondary/50">
              <Link to={`/player/${p.user_id}`}><Avatar className="h-8 w-8"><AvatarImage src={p.avatar_url ?? ''} /><AvatarFallback>{p.username?.[0]?.toUpperCase()}</AvatarFallback></Avatar></Link>
              <Link to={`/player/${p.user_id}`} className="text-sm font-medium truncate flex-1">{p.username}</Link>
              <FollowButton userId={p.user_id} username={p.username} size="sm" variant="ghost" showText={false} className="h-7 w-7 p-0" />
            </div>
          ))}
        </div>
      </div>
    </SocialLayout>
  );
}

function Panel({ title, items }: { title: string; items: Profile[] }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <h2 className="font-display font-bold text-sm mb-3">{title}</h2>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">No one yet.</p> : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.user_id}>
              <Link to={`/player/${p.user_id}`} className="flex items-center gap-2 p-2 rounded hover:bg-secondary">
                <Avatar className="h-8 w-8"><AvatarImage src={p.avatar_url ?? ''} /><AvatarFallback>{p.username?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
                <span className="text-sm font-medium">{p.username}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/router-compat';
import { X, Trophy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function SuggestionsRail() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['suggestions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: following } = await supabase.from('user_follows').select('following_id').eq('follower_id', user.id);
      const followingIds = new Set((following ?? []).map((f: any) => f.following_id));
      followingIds.add(user.id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, total_wins')
        .not('user_id', 'in', '(' + [...followingIds].join(',') + ')')
        .order('total_wins', { ascending: false })
        .limit(10);
      return (profiles ?? []).filter((p: any) => !dismissed.has(p.user_id)).slice(0, 5);
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('user_follows').insert({ follower_id: user.id, following_id: userId });
      if (error) throw error;
    },
    onSuccess: (_, userId) => {
      // Don't remove immediately, just change button state
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      toast.success('Following!');
    },
  });

  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const handleFollow = (userId: string) => {
    setFollowingMap(prev => ({ ...prev, [userId]: true }));
    followMutation.mutate(userId);
  };

  if (!user || (suggestions.length === 0 && !isLoading)) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm text-muted-foreground tracking-tight">Suggested for you</h3>
        <Link to="/explore" className="text-xs font-bold hover:text-muted-foreground transition-colors">See All</Link>
      </div>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-11 h-11 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-20" />
                <div className="h-2 bg-muted rounded w-32" />
              </div>
              <div className="w-16 h-7 bg-muted rounded-md" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((s: any) => (
            <div key={s.user_id} className="flex items-center gap-3 group">
              <Link to={'/player/' + s.user_id}>
                <Avatar className="h-11 w-11 cursor-pointer">
                  <AvatarImage src={s.avatar_url} className="object-cover" />
                  <AvatarFallback className="font-bold text-foreground bg-secondary">{s.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={'/player/' + s.user_id} className="text-sm font-bold hover:text-muted-foreground truncate block tracking-tight">
                  {s.username}
                </Link>
                <div className="text-xs text-muted-foreground truncate">
                  {s.total_wins > 0 ? `Suggested · ${s.total_wins} wins` : 'Suggested for you'}
                </div>
              </div>
              {followingMap[s.user_id] ? (
                <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs font-bold w-[90px] border-border text-foreground hover:bg-transparent">
                  Following
                </Button>
              ) : (
                <Button size="sm" className="h-8 rounded-lg text-xs font-bold w-[90px] bg-primary text-primary-foreground hover:bg-primary/90" 
                  onClick={() => handleFollow(s.user_id)} disabled={followMutation.isPending}>
                  Follow
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-xs text-muted-foreground/60 leading-relaxed">
        <div className="flex flex-wrap gap-x-2 gap-y-1 mb-3">
          <Link to="/about" className="hover:underline">About</Link>
          <Link to="/help" className="hover:underline">Help</Link>
          <Link to="/api" className="hover:underline">API</Link>
          <Link to="/privacy" className="hover:underline">Privacy</Link>
          <Link to="/terms" className="hover:underline">Terms</Link>
        </div>
        <p className="tracking-tight">© 2024 GAMEFLEX BY REPLIT</p>
      </div>
    </div>
  );
}
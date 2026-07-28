import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { SocialLayout } from '@/components/social/social-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, subHours } from 'date-fns';
import { Camera, Plus, Layers } from 'lucide-react';
import { StoryViewer } from '@/components/social/stories-rail';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { resolveStoryGradient, isVideoStory } from '@/features/stories/gradients';

export default function Stories() {
  const { user, isLoading: authLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [showViewer, setShowViewer] = useState(false);
  const [viewingIndex, setViewingIndex] = useState(0);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      nav(`/login?returnTo=${encodeURIComponent(location.pathname)}`);
    }
  }, [authLoading, user]); // nav/location excluded — new refs each render

  const { data: userGroups = [], isLoading } = useQuery({
    queryKey: ['stories-grid'],
    staleTime: 60_000,
    queryFn: async () => {
      const cutoff = subHours(new Date(), 24).toISOString();
      const { data } = await supabase
        .from('user_statuses')
        .select('*')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true }); // chronological
      
      if (!data?.length) return [];
      
      const ids = [...new Set(data.map((s: any) => s.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', ids);
      const map = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);
      
      const grouped = new Map<string, any[]>();
      for (const s of data) {
        const arr = grouped.get(s.user_id) || [];
        arr.push(s);
        grouped.set(s.user_id, arr);
      }

      return Array.from(grouped.entries()).map(([user_id, stories]) => ({
        user_id,
        profile: map.get(user_id) || { username: 'Unknown' },
        stories,
      })).sort((a, b) => {
        const aLatest = new Date(a.stories[a.stories.length - 1].created_at).getTime();
        const bLatest = new Date(b.stories[b.stories.length - 1].created_at).getTime();
        return bLatest - aLatest;
      });
    },
  });

  const openStory = (idx: number) => {
    setViewingIndex(idx);
    setShowViewer(true);
  };

  return (
    <SocialLayout
      title="Stories"
      subtitle="Stories from the community • Expire in 24 hours"
      headerRight={
        <>
          <Button asChild size="sm" className="gap-2 hidden md:inline-flex">
            <Link to="/stories/new">
              <Plus className="h-4 w-4" />
              Create Story
            </Link>
          </Button>
          <Button asChild size="icon" className="md:hidden rounded-full h-8 w-8">
            <Link to="/stories/new" aria-label="Create story">
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
        </>
      }
    >
      <div className="px-4 md:px-0">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="aspect-[9/16] rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : userGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4 bg-card/30 rounded-2xl border border-border/50">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center shadow-inner">
              <Camera className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-semibold text-lg mb-1">No active stories</p>
              <p className="text-sm text-muted-foreground mb-6">Stories from the community will appear here.</p>
              <Button asChild size="lg">
                <Link to="/stories/new">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Your First Story
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {userGroups.map((g, idx) => {
              const latestStory = g.stories[g.stories.length - 1];
              const isVideo = isVideoStory(latestStory);

              return (
                <button
                  key={g.user_id}
                  type="button"
                  onClick={() => openStory(idx)}
                  className="flex flex-col text-left group cursor-pointer"
                >
                  <div className="relative aspect-[9/16] rounded-xl overflow-hidden mb-3 bg-secondary border border-border/50 group-hover:border-primary/50 transition-colors shadow-sm">
                    {isVideo ? (
                      <video src={latestStory.media_url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" muted playsInline />
                    ) : latestStory.media_url ? (
                      <img src={latestStory.media_url} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center p-4 text-center opacity-90 group-hover:opacity-100 transition-opacity"
                        style={{ background: resolveStoryGradient(latestStory.media_type, idx) }}
                      >
                        <div
                          className="absolute inset-0 opacity-10 pointer-events-none"
                          style={{
                            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                            backgroundSize: '20px 20px',
                          }}
                        />
                        <p className="font-display text-sm font-bold text-white drop-shadow-md z-10 line-clamp-4">
                          {latestStory.content}
                        </p>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                    
                    {g.stories.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold text-white flex items-center gap-1 border border-white/10">
                        <Layers className="h-3 w-3" />
                        {g.stories.length}
                      </div>
                    )}
                    
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                      <div className="p-0.5 rounded-full bg-gradient-to-tr from-primary via-accent to-yellow-500 shadow-sm shrink-0">
                        <Avatar className="h-8 w-8 border border-background">
                          <AvatarImage src={g.profile?.avatar_url} />
                          <AvatarFallback className="text-[10px] font-bold bg-muted text-foreground">
                            {g.profile?.username?.[0]?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0 flex-1 drop-shadow-md">
                        <div className="text-sm font-semibold text-white truncate">{g.profile?.username}</div>
                        <div className="text-[10px] text-white/80 font-medium">
                          {formatDistanceToNow(new Date(latestStory.created_at))} ago
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showViewer && userGroups.length > 0 && (
        <StoryViewer
          userGroups={userGroups}
          initialGroupIndex={viewingIndex}
          onClose={() => setShowViewer(false)}
        />
      )}
    </SocialLayout>
  );
}
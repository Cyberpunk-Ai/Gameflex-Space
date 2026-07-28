// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Send, Bookmark, Trash2, TrendingUp, RefreshCw, MoreHorizontal, Users } from 'lucide-react';
import { resolveStoryGradient } from '@/features/stories/gradients';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef, useMemo } from 'react';
import { StatusComments } from '@/components/social/status-comments';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

function sanitizeText(t: string) { return t.replace(/<[^>]*>/g, '').trim(); }

function AutoplayVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      onClick={(e) => {
        const v = e.currentTarget;
        v.muted = !v.muted;
      }}
      className="w-full max-h-[600px] object-cover"
    />
  );
}

function getSessionSeed(): number {
  let seed = sessionStorage.getItem('feedSeed');
  if (!seed) {
    seed = String(Math.random());
    sessionStorage.setItem('feedSeed', seed);
  }
  return parseFloat(seed);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function StatusFeed({ mode = 'foryou' }: { mode?: 'foryou' | 'trending' | 'following' } = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const viewedRef = useRef<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(10);
  const [trendingRefreshKey, setTrendingRefreshKey] = useState(0);

  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const { data: rawStatuses = [], isLoading } = useQuery({
    queryKey: ['user-statuses', mode, user?.id ?? 'anon', trendingRefreshKey],
    queryFn: async () => {
      let query = supabase
        .from('user_statuses')
        .select('*');

      if (mode === 'following' && user) {
        const { data: follows } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id);
        const ids = follows?.map((f: any) => f.following_id) ?? [];
        if (ids.length === 0) return [];
        query = query.in('user_id', ids).order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false }).limit(100);
      }

      const { data } = await query;
      if (!data) return [];

      const userIds = [...new Set(data.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);

      let userLikes: string[] = [];
      if (user) {
        const { data: likes } = await supabase
          .from('status_likes')
          .select('status_id')
          .eq('user_id', user.id);
        userLikes = likes?.map(l => l.status_id) ?? [];
      }

      let userFollows: string[] = [];
      if (user) {
        const { data: follows } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id);
        userFollows = follows?.map(f => f.following_id) ?? [];
      }

      return data.map(s => ({
        ...s,
        profile: profileMap.get(s.user_id),
        isLiked: userLikes.includes(s.id),
        isFollowing: userFollows.includes(s.user_id)
      }));
    }
  });

  const rankedStatuses = useMemo(() => {
    if (rawStatuses.length === 0) return [];

    if (mode === 'following') {
      return rawStatuses;
    }

    if (mode === 'trending') {
      const now = Date.now();
      const cutoff = 72 * 3_600_000;
      return [...rawStatuses]
        .filter(s => (now - new Date(s.created_at).getTime()) < cutoff)
        .sort((a, b) => {
          const scoreA = (a.likes_count ?? 0) * 5 + (a.comments_count ?? 0) * 4 + (a.views_count ?? 0) * 0.2;
          const scoreB = (b.likes_count ?? 0) * 5 + (b.comments_count ?? 0) * 4 + (b.views_count ?? 0) * 0.2;
          return scoreB - scoreA;
        });
    }

    const now = Date.now();
    const seed = getSessionSeed();
    const seenUsers = new Set<string>();
    
    const scored = rawStatuses.map((s, idx) => {
      const hoursOld = (now - new Date(s.created_at).getTime()) / 3_600_000;
      const recencyDecay = Math.exp(-hoursOld / 48);
      const engagementScore = (s.likes_count ?? 0) * 4 + (s.comments_count ?? 0) * 3 + (s.shares_count ?? 0) * 2 + (s.views_count ?? 0) * 0.1;
      const followingBoost = s.isFollowing ? 1.5 : 1.0;
      const mediaBoost = s.media_url ? 1.3 : 1.0;
      const randomJitter = 0.9 + seededRandom(seed + idx) * 0.2;
      
      let score = engagementScore * recencyDecay * followingBoost * mediaBoost * randomJitter;
      return { ...s, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const diversified: any[] = [];
    for (const item of scored) {
      if (seenUsers.has(item.user_id)) continue;
      diversified.push(item);
      seenUsers.add(item.user_id);
    }
    for (const item of scored) {
      if (!diversified.includes(item)) {
        diversified.push(item);
      }
    }

    return diversified;
  }, [rawStatuses, mode]);

  const visibleStatuses = rankedStatuses.slice(0, visibleCount);

  useEffect(() => {
    const channel = supabase
      .channel('statuses-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_statuses' },
        () => queryClient.invalidateQueries({ queryKey: ['user-statuses'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!visibleStatuses.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.statusId;
            if (id && !viewedRef.current.has(id)) {
              viewedRef.current.add(id);
              incrementView(id);
            }

            const isLast = (entry.target as HTMLElement).dataset.isLast === 'true';
            if (isLast && visibleCount < rankedStatuses.length) {
              setVisibleCount(prev => Math.min(prev + 10, rankedStatuses.length));
            }
          }
        }
      },
      { threshold: 0.5 }
    );

    const cards = document.querySelectorAll('[data-status-id]');
    cards.forEach(card => observer.observe(card));

    return () => observer.disconnect();
  }, [visibleStatuses, visibleCount, rankedStatuses.length]);

  const likeMutation = useMutation({
    mutationFn: async ({ statusId, isLiked }: { statusId: string; isLiked: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      if (isLiked) {
        await supabase
          .from('status_likes')
          .delete()
          .eq('status_id', statusId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('status_likes')
          .insert({ status_id: statusId, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (statusId: string) => {
      const { error } = await supabase
        .from('user_statuses')
        .delete()
        .eq('id', statusId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
    }
  });

  const incrementView = async (statusId: string) => {
    try {
      const { data: current } = await supabase
        .from('user_statuses')
        .select('views_count')
        .eq('id', statusId)
        .single();
      await supabase
        .from('user_statuses')
        .update({ views_count: (current?.views_count ?? 0) + 1 })
        .eq('id', statusId);
    } catch {
      // silently ignore
    }
  };

  const [likeAnimations, setLikeAnimations] = useState<Set<string>>(new Set());

  const handleDoubleTap = (statusId: string, isLiked: boolean) => {
    if (!user) return;
    setLikeAnimations(prev => new Set(prev).add(statusId));
    setTimeout(() => {
      setLikeAnimations(prev => {
        const next = new Set(prev);
        next.delete(statusId);
        return next;
      });
    }, 800);
    if (!isLiked) {
      likeMutation.mutate({ statusId, isLiked });
    }
  };

  const toggleSave = (statusId: string) => {
    setSavedPosts(prev => {
      const next = new Set(prev);
      if (next.has(statusId)) next.delete(statusId);
      else next.add(statusId);
      return next;
    });
  };

  const recentPosts = useMemo(() => {
    if (mode !== 'following') return 0;
    const twoHoursAgo = Date.now() - 2 * 3_600_000;
    return rawStatuses.filter(s => new Date(s.created_at).getTime() > twoHoursAgo).length;
  }, [rawStatuses, mode]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse md:border md:border-border/50 md:rounded-xl md:bg-card">
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-3 bg-muted rounded w-16" />
              </div>
            </div>
            <div className="w-full aspect-square bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (visibleStatuses.length === 0) {
    if (mode === 'following') {
      return (
        <div className="text-center py-16 px-4">
          <div className="rounded-full bg-muted w-20 h-20 flex items-center justify-center mx-auto mb-4 border-2 border-border/50">
            <Users className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="font-semibold text-xl mb-2 text-foreground tracking-tight">Follow more players</p>
          <p className="text-sm text-muted-foreground mb-6">See what gamers are up to in your feed.</p>
          <Button asChild className="rounded-full font-bold">
            <Link to="/explore">Find Players</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="text-center py-16 px-4">
        <div className="rounded-full bg-muted w-20 h-20 flex items-center justify-center mx-auto mb-4 border-2 border-border/50">
          <MessageCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <p className="font-semibold text-xl mb-1 tracking-tight">No posts yet</p>
        <p className="text-sm text-muted-foreground">Be the first to share what's on your mind</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-6">
      {mode === 'following' && recentPosts > 0 && (
        <div className="mx-4 md:mx-0 flex justify-center">
          <div className="bg-primary/20 backdrop-blur-md rounded-full px-4 py-1.5 text-xs text-primary font-bold shadow-[0_0_15px_rgba(34,197,94,0.2)] flex items-center gap-2 cursor-pointer border border-primary/30"
               onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(34,197,94,1)]" />
            New Posts
          </div>
        </div>
      )}

      {mode === 'trending' && (
        <div className="mx-4 md:mx-0 flex items-center justify-between bg-card border border-border/50 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-primary font-bold">
            <TrendingUp className="h-5 w-5" />
            <span>Trending Gaming Content</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setTrendingRefreshKey(k => k + 1)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {visibleStatuses.map((status, idx) => (
        <motion.div
          key={status.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3) }}
          className="bg-card md:border md:border-border/50 md:rounded-2xl md:overflow-hidden pb-3 md:pb-0 border-b border-border/20 last:border-b-0"
          data-status-id={status.id}
          data-is-last={idx === visibleStatuses.length - 1}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 md:p-4">
            <div className="flex items-center gap-3">
              <Link to={`/player/${status.user_id}`}>
                <div className={cn("p-[2px] rounded-full", status.isFollowing && "bg-gradient-to-tr from-primary to-accent")}>
                  <Avatar className="h-9 w-9 border-2 border-background object-cover cursor-pointer">
                    <AvatarImage src={status.profile?.avatar_url} />
                    <AvatarFallback className="font-bold bg-secondary">
                      {status.profile?.username?.charAt(0).toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </Link>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <Link to={`/player/${status.user_id}`} className="font-bold text-[15px] hover:text-muted-foreground transition-colors tracking-tight">
                    {status.profile?.username ?? 'Unknown'}
                  </Link>
                  {mode === 'trending' && idx < 3 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-black uppercase tracking-wider">
                      #{idx + 1}
                    </span>
                  )}
                  <span className="text-muted-foreground text-sm font-medium">· {formatDistanceToNow(new Date(status.created_at), { addSuffix: false }).replace('about ', '').replace('less than a minute', 'now').replace(' hours', 'h').replace(' minutes', 'm')}</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>

          {/* Media / Gradient card */}
          {status.media_url ? (
            <div
              className="relative w-full bg-black overflow-hidden cursor-pointer"
              onDoubleClick={() => handleDoubleTap(status.id, status.isLiked)}
            >
              {status.media_type === 'video' ? (
                <div className="aspect-[4/5] sm:aspect-auto sm:max-h-[600px] overflow-hidden flex items-center justify-center">
                  <AutoplayVideo src={status.media_url} />
                </div>
              ) : (
                <div className="aspect-[4/5] sm:aspect-auto overflow-hidden">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={status.media_url}
                    alt="Status media"
                    className="w-full h-full sm:h-auto sm:max-h-[600px] object-cover"
                  />
                </div>
              )}
              <AnimatePresence>
                {likeAnimations.has(status.id) && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.3, 1.1], opacity: [0, 1, 1] }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                  >
                    <Heart className="h-28 w-28 text-[#ff3040] fill-[#ff3040] drop-shadow-[0_0_50px_rgba(255,48,64,0.7)]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : status.content ? (
            /* Text-only post → gradient card */
            <div
              className="relative w-full aspect-square flex items-center justify-center cursor-pointer select-none overflow-hidden"
              style={{ background: resolveStoryGradient(status.media_type, idx) }}
              onDoubleClick={() => handleDoubleTap(status.id, status.isLiked)}
            >
              {/* Subtle dot-grid texture */}
              <div
                className="absolute inset-0 opacity-[0.07] pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)',
                  backgroundSize: '28px 28px',
                }}
              />
              <p className="relative z-10 text-white font-bold text-2xl leading-snug text-center px-8 drop-shadow-lg line-clamp-6 tracking-tight">
                {sanitizeText(status.content)}
              </p>
              <AnimatePresence>
                {likeAnimations.has(status.id) && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.3, 1.1], opacity: [0, 1, 1] }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                  >
                    <Heart className="h-28 w-28 text-[#ff3040] fill-[#ff3040] drop-shadow-[0_0_50px_rgba(255,48,64,0.7)]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : null}

          {/* Action Bar */}
          <div className="p-3 md:px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => user && likeMutation.mutate({ statusId: status.id, isLiked: status.isLiked })}
                className="hover:opacity-60 transition-opacity active:scale-90"
              >
                <Heart className={cn("h-[26px] w-[26px] transition-colors", status.isLiked ? "fill-[#ff3040] text-[#ff3040]" : "text-foreground")} />
              </button>
              <button
                onClick={() => setExpandedComments(prev => {
                  const next = new Set(prev);
                  if (next.has(status.id)) next.delete(status.id); else next.add(status.id);
                  return next;
                })}
                className="hover:opacity-60 transition-opacity active:scale-90"
              >
                <MessageCircle className={cn("h-[26px] w-[26px] transition-colors", expandedComments.has(status.id) ? "fill-foreground text-foreground" : "text-foreground")} />
              </button>
              <button className="hover:opacity-60 transition-opacity active:scale-90"
                onClick={async () => {
                  const url = `${window.location.origin}/social?status=${status.id}`;
                  if (navigator.share) {
                    try { await navigator.share({ title: 'Check out this post on GameFlex', url }); return; } catch {}
                  }
                  navigator.clipboard.writeText(url);
                  toast({ title: 'Link copied to clipboard' });
                }}>
                <Send className="h-[26px] w-[26px] text-foreground" />
              </button>
            </div>
            <button onClick={() => toggleSave(status.id)} className="hover:opacity-60 transition-opacity active:scale-90">
              <Bookmark className={cn("h-[26px] w-[26px] transition-colors", savedPosts.has(status.id) ? "fill-foreground text-foreground" : "text-foreground")} />
            </button>
          </div>

          {/* Likes & Content */}
          <div className="px-3 md:px-4 pb-2">
            <div className="font-bold text-[14px] mb-1 tracking-tight">
              {(status.likes_count ?? 0).toLocaleString()} likes
            </div>

            {status.content && (
              <div className="text-[14px] leading-[18px]">
                <span className="font-bold mr-2 tracking-tight">{status.profile?.username}</span>
                {sanitizeText(status.content).split(' ').map((word, i) => {
                  if (word.startsWith('#')) return <span key={i} className="text-primary hover:underline cursor-pointer">{word} </span>;
                  return <span key={i}>{word} </span>;
                })}
              </div>
            )}
            
            <StatusComments statusId={status.id} commentsCount={status.comments_count ?? 0} open={expandedComments.has(status.id)} />
          </div>
        </motion.div>
      ))}

      {visibleCount < rankedStatuses.length && (
        <div className="text-center py-6">
          <Button variant="outline" className="rounded-full font-bold" onClick={() => setVisibleCount(prev => Math.min(prev + 10, rankedStatuses.length))}>
            Load more posts
          </Button>
        </div>
      )}
    </div>
  );
}
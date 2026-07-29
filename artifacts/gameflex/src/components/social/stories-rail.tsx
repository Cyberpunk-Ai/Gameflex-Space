// @ts-nocheck
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth-context';
import { Plus, X, Pause, Send, Heart, MessageCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { subHours, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveStoryGradient, isVideoStory } from '@/features/stories/gradients';
import { encryptMessage, decryptMessage } from '@/lib/encryption';

// ─── emoji reactions ──────────────────────────────────────────────────────────

const REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '🎮'] as const;

// ─── StoryViewer ─────────────────────────────────────────────────────────────

export function StoryViewer({
  userGroups,
  initialGroupIndex = 0,
  onClose,
}: {
  userGroups: { user_id: string; profile: any; stories: any[] }[];
  initialGroupIndex?: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [reactionAnim, setReactionAnim] = useState<string | null>(null);
  const [likeAnim, setLikeAnim] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentGroup = userGroups[groupIndex];
  const story = currentGroup?.stories[storyIndex];

  // ── pause when comments panel is open ──
  useEffect(() => { setIsPaused(showComments); }, [showComments]);

  // ── comments for current story ──
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['story-comments', story?.id],
    enabled: showComments && !!story,
    queryFn: async () => {
      const { data } = await supabase
        .from('status_comments')
        .select('*')
        .eq('status_id', story.id)
        .order('created_at', { ascending: true });
      if (!data?.length) return [];
      const ids = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, username, avatar_url').in('user_id', ids);
      const pm = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);
      return Promise.all(data.map(async (c: any) => {
        let text = c.content;
        if (c.is_encrypted) {
          try { text = await decryptMessage(c.content); } catch {}
        }
        return { ...c, profile: pm.get(c.user_id), displayText: text };
      }));
    },
  });

  // ── likes for current story ──
  const { data: storyLikes } = useQuery({
    queryKey: ['story-likes', story?.id, user?.id],
    enabled: !!story,
    staleTime: 30_000,
    queryFn: async () => {
      const countRes = await supabase
        .from('status_likes').select('id', { count: 'exact', head: true }).eq('status_id', story.id);
      let isLiked = false;
      if (user) {
        const { data } = await supabase.from('status_likes')
          .select('id').eq('status_id', story.id).eq('user_id', user.id).maybeSingle();
        isLiked = !!data;
      }
      return { count: countRes.count ?? 0, isLiked };
    },
  });

  const likeMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sign in to react');
      if (storyLikes?.isLiked) {
        await supabase.from('status_likes').delete().eq('status_id', story.id).eq('user_id', user.id);
      } else {
        await supabase.from('status_likes').insert({ status_id: story.id, user_id: user.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['story-likes', story?.id] });
      qc.invalidateQueries({ queryKey: ['my-stories'] });
    },
  });

  const replyMut = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Sign in to comment');
      const enc = await encryptMessage(content);
      const { error } = await supabase.from('status_comments').insert({
        status_id: story.id, user_id: user.id, content: enc, is_encrypted: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['story-comments', story?.id] });
      qc.invalidateQueries({ queryKey: ['my-stories'] });
      setReplyText('');
    },
  });

  const handleReact = (emoji: string) => {
    setReactionAnim(emoji);
    setTimeout(() => setReactionAnim(null), 900);
    if (!storyLikes?.isLiked) {
      likeMut.mutate();
    }
    // also send emoji as comment
    if (user) {
      supabase.from('status_comments').insert({
        status_id: story.id, user_id: user.id, content: emoji, is_encrypted: false,
      }).then(() => qc.invalidateQueries({ queryKey: ['story-comments', story?.id] }));
    }
  };

  const handleLike = () => {
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 700);
    likeMut.mutate();
  };

  const DURATION = 6000;
  const TICK = 30;

  const goNext = useCallback(() => {
    if (!currentGroup) return;
    const ns = storyIndex + 1;
    if (ns >= currentGroup.stories.length) {
      const ng = groupIndex + 1;
      if (ng >= userGroups.length) { onClose(); return; }
      setGroupIndex(ng); setStoryIndex(0);
    } else {
      setStoryIndex(ns);
    }
    setProgress(0); setShowComments(false);
  }, [currentGroup, storyIndex, groupIndex, userGroups.length, onClose]);

  const goPrev = useCallback(() => {
    if (!currentGroup) return;
    const ps = storyIndex - 1;
    if (ps < 0) {
      const pg = groupIndex - 1;
      if (pg < 0) return;
      setGroupIndex(pg); setStoryIndex(userGroups[pg].stories.length - 1);
    } else {
      setStoryIndex(ps);
    }
    setProgress(0); setShowComments(false);
  }, [currentGroup, storyIndex, groupIndex, userGroups]);

  useEffect(() => {
    if (!story || isPaused) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        const n = p + (TICK / DURATION) * 100;
        if (n >= 100) { clearInterval(intervalRef.current!); goNext(); return 100; }
        return n;
      });
    }, TICK);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [groupIndex, storyIndex, story, isPaused, goNext]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (showComments) { setShowComments(false); return; } onClose(); }
      if (e.key === 'ArrowRight' && !showComments) goNext();
      if (e.key === 'ArrowLeft' && !showComments) goPrev();
      if (e.key === ' ') setIsPaused(p => !p);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goNext, goPrev, onClose, showComments]);

  if (!story) return null;
  const isVideo = isVideoStory(story);
  const isLiked = storyLikes?.isLiked ?? false;
  const likeCount = storyLikes?.count ?? story.likes_count ?? 0;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center">
      <div className="relative w-full max-w-[450px] h-[100dvh] md:h-[90vh] md:rounded-[32px] overflow-hidden bg-zinc-900 flex items-center justify-center shadow-2xl">

        {/* story content */}
        {isVideo ? (
          <video key={story.id} src={story.media_url} autoPlay playsInline muted={false} loop={false}
            onEnded={goNext} onPlay={() => setIsPaused(false)} onPause={() => setIsPaused(true)}
            className="w-full h-full object-cover" />
        ) : story.media_url ? (
          <img key={story.id} src={story.media_url} alt="Story" className="w-full h-full object-cover" />
        ) : (
          <div key={story.id} className="w-full h-full flex items-center justify-center p-8 text-center"
            style={{ background: resolveStoryGradient(story.media_type, storyIndex) }}>
            <div className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            <p className="font-display text-4xl font-bold text-white drop-shadow-2xl z-10 leading-tight tracking-tight">
              {story.content}
            </p>
          </div>
        )}

        {/* reaction floating anim */}
        <AnimatePresence>
          {reactionAnim && (
            <motion.div key={reactionAnim}
              initial={{ scale: 0, opacity: 0, y: 0 }}
              animate={{ scale: [0, 1.6, 1.2], opacity: [0, 1, 0], y: -80 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            >
              <span className="text-6xl drop-shadow-lg">{reactionAnim}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* like heart anim */}
        <AnimatePresence>
          {likeAnim && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.4, 1.1], opacity: [0, 1, 0] }}
              exit={{ opacity: 0 }} transition={{ duration: 0.7 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <Heart className="h-24 w-24 text-rose-400 fill-rose-400 drop-shadow-[0_0_40px_rgba(244,63,94,0.8)]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top: progress + header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-4 pb-16 px-4 z-10 pointer-events-none">
          <div className="flex gap-1.5 mb-4">
            {currentGroup.stories.map((s: any, i: number) => (
              <div key={s.id} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden backdrop-blur-md">
                <div className="h-full rounded-full transition-none"
                  style={{
                    width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%',
                    background: i <= storyIndex ? 'linear-gradient(90deg, hsl(142 76% 45%), hsl(180 100% 50%))' : 'transparent'
                  }} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-background/20 ring-2 ring-primary">
                <AvatarImage src={currentGroup.profile?.avatar_url} />
                <AvatarFallback className="text-xs font-bold bg-secondary text-foreground">
                  {currentGroup.profile?.username?.[0]?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="drop-shadow-md">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm">{currentGroup.profile?.username ?? 'User'}</span>
                  <span className="text-white/60 text-xs">{formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-all active:scale-95"
              aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Caption */}
        {story.content && story.media_url && (
          <div className="absolute bottom-36 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-6 pb-6 pt-16 z-10 pointer-events-none">
            <p className="text-white text-base font-medium leading-relaxed drop-shadow-lg">{story.content}</p>
          </div>
        )}

        {/* ── Bottom engagement area ── */}
        {!showComments ? (
          <div className="absolute bottom-0 left-0 right-0 z-20">
            {/* Reaction row */}
            <div className="flex items-center justify-between px-4 pb-2 pt-2">
              <div className="flex items-center gap-2">
                {REACTIONS.map(emoji => (
                  <button key={emoji} onClick={() => handleReact(emoji)}
                    className="text-2xl hover:scale-125 active:scale-95 transition-transform drop-shadow-lg">
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {/* like count */}
                <button onClick={handleLike} className="flex items-center gap-1.5 text-white active:scale-90 transition-transform">
                  <Heart className={cn('h-6 w-6 transition-colors', isLiked ? 'fill-rose-400 text-rose-400' : 'text-white')} />
                  {likeCount > 0 && <span className="text-xs font-bold text-white/90">{likeCount}</span>}
                </button>
                {/* comments toggle */}
                <button onClick={() => setShowComments(true)}
                  className="flex items-center gap-1.5 text-white active:scale-90 transition-transform">
                  <MessageCircle className="h-6 w-6 text-white" />
                  {(story.comments_count ?? 0) > 0 && (
                    <span className="text-xs font-bold text-white/90">{story.comments_count}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Reply input */}
            <div className="px-4 pb-6 pt-1 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && replyText.trim()) { e.preventDefault(); replyMut.mutate(replyText.trim()); } }}
                  placeholder={user ? `Reply to ${currentGroup.profile?.username}…` : 'Sign in to reply…'}
                  disabled={!user}
                  className="flex-1 bg-black/40 border border-white/20 rounded-full py-3 px-5 text-white placeholder:text-white/50 text-sm focus:outline-none focus:border-white/50 backdrop-blur-md"
                />
                {replyText.trim() && (
                  <button onClick={() => replyMut.mutate(replyText.trim())} disabled={replyMut.isPending}
                    className="h-10 w-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0">
                    <Send className="h-4 w-4 text-primary-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Comments panel ── */
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="absolute bottom-0 left-0 right-0 z-30 bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10"
          >
            {/* handle */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <p className="text-white font-bold text-sm">
                Comments {(story.comments_count ?? 0) > 0 && <span className="text-white/50 font-normal">({story.comments_count})</span>}
              </p>
              <button onClick={() => setShowComments(false)}
                className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <ChevronDown className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* comment list */}
            <div className="overflow-y-auto max-h-60 px-4 py-3 space-y-3">
              {commentsLoading ? (
                <p className="text-white/50 text-sm text-center py-4">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-4">No comments yet. Be the first!</p>
              ) : (
                comments.map((c: any) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <Avatar className="h-7 w-7 shrink-0 border border-white/10">
                      <AvatarImage src={c.profile?.avatar_url} />
                      <AvatarFallback className="text-[9px] bg-secondary text-foreground font-bold">
                        {c.profile?.username?.[0]?.toUpperCase() ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-white text-xs font-bold">{c.profile?.username ?? 'User'}</span>
                        <span className="text-white/40 text-[10px]">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-white/80 text-sm mt-0.5 break-words">{c.displayText}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* comment input */}
            <div className="px-4 pb-6 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && replyText.trim()) { e.preventDefault(); replyMut.mutate(replyText.trim()); } }}
                  placeholder={user ? 'Add a comment…' : 'Sign in to comment…'}
                  disabled={!user || replyMut.isPending}
                  className="flex-1 bg-white/10 border border-white/10 rounded-full py-2.5 px-4 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-white/30"
                />
                {replyText.trim() && (
                  <button onClick={() => replyMut.mutate(replyText.trim())} disabled={replyMut.isPending}
                    className="h-9 w-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 shrink-0 transition-colors">
                    <Send className="h-4 w-4 text-primary-foreground" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* pause indicator */}
        {isPaused && !showComments && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="bg-black/40 rounded-full p-4 backdrop-blur-sm">
              <Pause className="h-10 w-10 text-white" />
            </div>
          </div>
        )}

        {/* tap zones (only when comments closed) */}
        {!showComments && (
          <>
            <div className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer"
              onClick={goPrev}
              onPointerDown={() => setIsPaused(true)}
              onPointerUp={() => setIsPaused(false)}
              onPointerLeave={() => setIsPaused(false)}>
              <div className="absolute inset-0 bg-gradient-radial from-white/10 to-transparent opacity-0 active:opacity-100 transition-opacity" />
            </div>
            <div className="absolute inset-y-0 right-0 w-2/3 z-20 cursor-pointer"
              onClick={goNext}
              onPointerDown={() => setIsPaused(true)}
              onPointerUp={() => setIsPaused(false)}
              onPointerLeave={() => setIsPaused(false)}>
              <div className="absolute inset-0 bg-gradient-radial from-white/10 to-transparent opacity-0 active:opacity-100 transition-opacity" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── StoriesRail ─────────────────────────────────────────────────────────────

export function StoriesRail() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [showViewer, setShowViewer] = useState(false);
  const [viewingGroupIndex, setViewingGroupIndex] = useState(0);

  const { data: userGroups = [], isLoading } = useQuery({
    queryKey: ['stories-rail'],
    staleTime: 60_000,
    queryFn: async () => {
      const cutoff = subHours(new Date(), 24).toISOString();
      const { data } = await supabase
        .from('user_statuses')
        .select('id, user_id, media_url, media_type, content, created_at')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true });

      if (!data?.length) return [];

      const ids = [...new Set(data.map((s: any) => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, username, avatar_url').in('user_id', ids);
      const profileMap = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);

      const grouped = new Map<string, any[]>();
      for (const s of data) {
        const arr = grouped.get(s.user_id) || [];
        arr.push(s);
        grouped.set(s.user_id, arr);
      }

      return Array.from(grouped.entries())
        .map(([user_id, stories]) => ({
          user_id,
          profile: profileMap.get(user_id) || { username: 'Unknown' },
          stories,
        }))
        .sort((a, b) => {
          const aT = new Date(a.stories[a.stories.length - 1].created_at).getTime();
          const bT = new Date(b.stories[b.stories.length - 1].created_at).getTime();
          return bT - aT;
        });
    },
  });

  const myGroupIndex = useMemo(() => userGroups.findIndex((g: any) => g.user_id === user?.id), [userGroups, user]);
  const hasOwnStory = myGroupIndex >= 0;

  const openViewer = (idx: number) => { setViewingGroupIndex(idx); setShowViewer(true); };

  if (!user && !isLoading && userGroups.length === 0) return null;

  return (
    <>
      <div className="mb-4">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 py-4 touch-pan-x snap-x snap-mandatory">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0 snap-start">
                <Skeleton className="h-[72px] w-[72px] rounded-full" />
                <Skeleton className="h-2 w-12 rounded-full" />
              </div>
            ))
          ) : (
            <>
              {user && (
                <div className="flex flex-col items-center gap-2 shrink-0 snap-start">
                  <div className="relative">
                    <button onClick={() => hasOwnStory ? openViewer(myGroupIndex) : nav('/stories/new')}
                      className="relative p-[3px] rounded-full transition-transform active:scale-95 group block"
                      style={{ background: hasOwnStory ? 'linear-gradient(135deg, hsl(142 76% 45%) 0%, hsl(180 100% 50%) 100%)' : 'var(--border)' }}
                      aria-label={hasOwnStory ? 'View your story' : 'Add story'}
                    >
                      <div className="bg-background rounded-full p-[2px]">
                        <Avatar className="h-[64px] w-[64px] border border-border/50">
                          <AvatarImage src={profile?.avatar_url ?? ''} className="object-cover" />
                          <AvatarFallback className="bg-secondary text-foreground font-bold">
                            {(profile?.username ?? 'U').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); nav('/stories/new'); }}
                      aria-label="Add to your story"
                      className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center border-[3px] border-background z-20 hover:scale-110 active:scale-95 transition-transform">
                      <Plus className="h-3 w-3 text-primary-foreground stroke-[3]" />
                    </button>
                  </div>
                  <span className="text-[12px] font-medium truncate w-20 text-center text-foreground/90">
                    {hasOwnStory ? 'Your story' : 'Add story'}
                  </span>
                </div>
              )}

              {userGroups.map((g: any, idx: number) => {
                if (g.user_id === user?.id) return null;
                return (
                  <button key={g.user_id} onClick={() => openViewer(idx)}
                    className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group snap-start">
                    <div className="relative p-[3px] rounded-full transition-transform active:scale-95"
                      style={{ background: 'linear-gradient(135deg, hsl(142 76% 45%) 0%, hsl(180 100% 50%) 100%)' }}>
                      <div className="bg-background rounded-full p-[2px]">
                        <Avatar className="h-[64px] w-[64px]">
                          <AvatarImage src={g.profile?.avatar_url} className="object-cover" />
                          <AvatarFallback className="bg-secondary font-bold text-foreground">
                            {g.profile?.username?.[0]?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    <span className="text-[12px] font-medium truncate w-20 text-center text-foreground/90">
                      {g.profile?.username ?? '—'}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showViewer && userGroups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100]"
          >
            <StoryViewer
              userGroups={userGroups}
              initialGroupIndex={viewingGroupIndex}
              onClose={() => setShowViewer(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

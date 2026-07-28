import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth-context';
import { Plus, X, Pause, Send } from 'lucide-react';
import { subHours, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveStoryGradient, isVideoStory, STORY_GRADIENTS } from '@/features/stories/gradients';

// ─── StoryViewer ────────────────────────────────────────────────────────────

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
  const queryClient = useQueryClient();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const replyMutation = useMutation({
    mutationFn: async ({ storyId, content }: { storyId: string; content: string }) => {
      if (!user) throw new Error('Sign in to reply');
      const { error } = await supabase.from('status_comments').insert({
        status_id: storyId,
        user_id: user.id,
        content,
        is_encrypted: false,
      });
      if (error) throw error;
    },
    onSuccess: (_, { storyId }) => {
      queryClient.invalidateQueries({ queryKey: ['status-comments', storyId] });
      setReplyText('');
    },
  });

  const handleReplySubmit = () => {
    const trimmed = replyText.trim();
    if (!trimmed || !story) return;
    replyMutation.mutate({ storyId: story.id, content: trimmed });
  };

  const DURATION = 6000;
  const TICK = 30;

  const currentGroup = userGroups[groupIndex];
  const story = currentGroup?.stories[storyIndex];

  const goNext = useCallback(() => {
    if (!currentGroup) return;
    const nextStory = storyIndex + 1;
    if (nextStory >= currentGroup.stories.length) {
      const nextGroup = groupIndex + 1;
      if (nextGroup >= userGroups.length) { onClose(); return; }
      setGroupIndex(nextGroup);
      setStoryIndex(0);
    } else {
      setStoryIndex(nextStory);
    }
    setProgress(0);
  }, [currentGroup, storyIndex, groupIndex, userGroups.length, onClose]);

  const goPrev = useCallback(() => {
    if (!currentGroup) return;
    const prevStory = storyIndex - 1;
    if (prevStory < 0) {
      const prevGroup = groupIndex - 1;
      if (prevGroup < 0) return;
      setGroupIndex(prevGroup);
      setStoryIndex(userGroups[prevGroup].stories.length - 1);
    } else {
      setStoryIndex(prevStory);
    }
    setProgress(0);
  }, [currentGroup, storyIndex, groupIndex, userGroups]);

  useEffect(() => {
    if (!story || isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        const next = p + (TICK / DURATION) * 100;
        if (next >= 100) { clearInterval(intervalRef.current!); goNext(); return 100; }
        return next;
      });
    }, TICK);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [groupIndex, storyIndex, story, isPaused, goNext]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === ' ') setIsPaused(p => !p);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose]);

  if (!story) return null;

  const isVideo = isVideoStory(story);


  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="relative w-full max-w-[450px] h-[100dvh] md:h-[90vh] md:rounded-[32px] overflow-hidden bg-zinc-900 flex items-center justify-center shadow-2xl">

        {isVideo ? (
          <video key={story.id} src={story.media_url} autoPlay playsInline muted={false} loop={false}
            onEnded={goNext} onPlay={() => setIsPaused(false)} onPause={() => setIsPaused(true)}
            className="w-full h-full object-cover" />
        ) : story.media_url ? (
          <img key={story.id} src={story.media_url} alt="Story" className="w-full h-full object-cover" />
        ) : (
          <div key={story.id} className="w-full h-full flex flex-col items-center justify-center p-8 text-center"
            style={{ background: resolveStoryGradient(story.media_type, storyIndex) }}>
            <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            <p className="font-display text-4xl font-bold text-white drop-shadow-2xl z-10 leading-tight tracking-tight">
              {story.content}
            </p>
          </div>
        )}

        {/* Top gradient + progress bars */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-4 pb-16 px-4 z-10 pointer-events-none">
          <div className="flex gap-1.5 mb-4">
            {currentGroup.stories.map((s, i) => (
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
                <AvatarFallback className="text-xs font-bold bg-secondary text-foreground">{currentGroup.profile?.username?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col drop-shadow-md">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm tracking-tight">{currentGroup.profile?.username ?? 'User'}</span>
                  <span className="text-white/60 text-xs font-medium">{formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}</span>
                </div>
                {currentGroup.profile?.followers_count != null && (
                  <span className="text-[10px] text-white/50">{currentGroup.profile.followers_count} followers</span>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-all active:scale-95"
              aria-label="Close story">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Caption overlay */}
        {story.content && story.media_url && (
          <div className="absolute bottom-24 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-8 pt-20 z-10 pointer-events-none">
            <p className="text-white text-base font-medium leading-relaxed drop-shadow-lg">{story.content}</p>
          </div>
        )}

        {/* Reply Input */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-30 bg-gradient-to-t from-black/80 to-transparent">
           <div className="relative flex items-center gap-2">
             <input
               type="text"
               placeholder={`Reply to ${currentGroup.profile?.username}...`}
               value={replyText}
               onChange={e => setReplyText(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleReplySubmit(); } }}
               className="flex-1 bg-black/40 border border-white/20 rounded-full py-3 px-5 text-white placeholder:text-white/60 text-sm focus:outline-none focus:border-white/50 backdrop-blur-md"
             />
             {replyText.trim() && (
               <button
                 onClick={handleReplySubmit}
                 disabled={replyMutation.isPending}
                 className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
               >
                 <Send className="h-4 w-4" />
               </button>
             )}
           </div>
        </div>

        {isPaused && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
             <div className="bg-black/40 rounded-full p-4 backdrop-blur-sm">
                <Pause className="h-10 w-10 text-white" />
             </div>
           </div>
        )}

        {/* Tap zones */}
        <div className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer"
          onClick={goPrev} onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)} onPointerLeave={() => setIsPaused(false)}>
          <div className="absolute inset-0 bg-gradient-radial from-white/10 to-transparent opacity-0 active:opacity-100 transition-opacity duration-300" />
        </div>
        <div className="absolute inset-y-0 right-0 w-2/3 z-20 cursor-pointer"
          onClick={goNext} onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)} onPointerLeave={() => setIsPaused(false)}>
          <div className="absolute inset-0 bg-gradient-radial from-white/10 to-transparent opacity-0 active:opacity-100 transition-opacity duration-300" />
        </div>
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
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', ids);

      const profileMap = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);

      const grouped = new Map<string, any[]>();
      for (const s of data) {
        const arr = grouped.get(s.user_id) || [];
        arr.push(s);
        grouped.set(s.user_id, arr);
      }

      return Array.from(grouped.entries()).map(([user_id, stories]) => ({
        user_id,
        profile: profileMap.get(user_id) || { username: 'Unknown' },
        stories,
      })).sort((a, b) => {
        const aLatest = new Date(a.stories[a.stories.length - 1].created_at).getTime();
        const bLatest = new Date(b.stories[b.stories.length - 1].created_at).getTime();
        return bLatest - aLatest;
      });
    },
  });

  const openViewer = (groupIndex: number) => {
    setViewingGroupIndex(groupIndex);
    setShowViewer(true);
  };

  const myGroupIndex = useMemo(() => userGroups.findIndex(g => g.user_id === user?.id), [userGroups, user]);
  const hasOwnStory = myGroupIndex >= 0;

  const handleOwnStoryClick = () => {
    if (hasOwnStory) {
      openViewer(myGroupIndex);
    } else {
      nav('/stories/new');
    }
  };

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
                    <button
                      onClick={handleOwnStoryClick}
                      className="relative p-[3px] rounded-full transition-transform active:scale-95 group block"
                      style={{ background: hasOwnStory ? 'linear-gradient(135deg, hsl(142 76% 45%) 0%, hsl(180 100% 50%) 100%)' : 'var(--border)' }}
                      aria-label={hasOwnStory ? 'View your story' : 'Add story'}
                    >
                      <div className="bg-background rounded-full p-[2px]">
                        <Avatar className="h-[64px] w-[64px] border border-border/50 object-cover">
                          <AvatarImage src={profile?.avatar_url ?? ''} className="object-cover" />
                          <AvatarFallback className="bg-secondary text-foreground font-bold">
                            {(profile?.username ?? 'U').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); nav('/stories/new'); }}
                      aria-label="Add to your story"
                      title="Add to your story"
                      className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center border-[3px] border-background z-20 hover:scale-110 active:scale-95 transition-transform"
                    >
                      <Plus className="h-3 w-3 text-primary-foreground stroke-[3]" />
                    </button>
                  </div>
                  <span className="text-[12px] font-medium truncate w-20 text-center text-foreground/90 tracking-tight">
                    {hasOwnStory ? 'Your story' : 'Add story'}
                  </span>
                </div>
              )}

              {userGroups.map((g, idx) => {
                if (g.user_id === user?.id) return null;
                return (
                  <button key={g.user_id} onClick={() => openViewer(idx)}
                    className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group snap-start">
                    <div className="relative p-[3px] rounded-full transition-transform active:scale-95"
                      style={{ background: 'linear-gradient(135deg, hsl(142 76% 45%) 0%, hsl(180 100% 50%) 100%)' }}>
                      <div className="bg-background rounded-full p-[2px]">
                        <Avatar className="h-[64px] w-[64px] object-cover">
                          <AvatarImage src={g.profile?.avatar_url} className="object-cover" />
                          <AvatarFallback className="bg-secondary font-bold text-foreground">
                            {g.profile?.username?.[0]?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    <span className="text-[12px] font-medium truncate w-20 text-center text-foreground/90 tracking-tight">
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
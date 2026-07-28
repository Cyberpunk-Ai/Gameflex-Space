import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { SocialLayout } from '@/components/social/social-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, subHours } from 'date-fns';
import { Camera, Plus, Layers, Heart, MessageCircle, Clock, Trash2, Pencil, BarChart3, Globe, ChevronRight } from 'lucide-react';
import { StoryViewer } from '@/components/social/stories-rail';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { resolveStoryGradient, isVideoStory, STORY_GRADIENTS, encodeTextStoryType } from '@/features/stories/gradients';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ─── types ───────────────────────────────────────────────────────────────────

interface Story {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  likes_count: number | null;
  comments_count: number | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function hoursLeft(createdAt: string) {
  const diff = 24 - (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return Math.max(0, diff);
}

// ─── My Story Card ────────────────────────────────────────────────────────────

function MyStoryCard({
  story,
  index,
  onDelete,
  onEdit,
  onView,
}: {
  story: Story;
  index: number;
  onDelete: (story: Story) => void;
  onEdit: (story: Story) => void;
  onView: () => void;
}) {
  const isText = !story.media_url;
  const isVideo = isVideoStory(story);
  const gradientCss = resolveStoryGradient(story.media_type, index);
  const remaining = hoursLeft(story.created_at);
  const likes = story.likes_count ?? 0;
  const comments = story.comments_count ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="flex items-center gap-4 bg-card/60 border border-border/50 rounded-2xl p-3 hover:border-border transition-colors group"
    >
      {/* Thumbnail */}
      <button
        onClick={onView}
        className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden border border-border/40 group-hover:border-primary/40 transition-colors"
        aria-label="View story"
      >
        {isVideo ? (
          <video src={story.media_url!} className="w-full h-full object-cover" muted playsInline />
        ) : story.media_url ? (
          <img src={story.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center p-1"
            style={{ background: gradientCss }}
          >
            <p className="text-[8px] font-bold text-white text-center line-clamp-3 leading-tight">
              {story.content ?? ''}
            </p>
          </div>
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {story.content
            ? story.content.length > 50
              ? story.content.slice(0, 50) + '…'
              : story.content
            : isVideo
            ? 'Video story'
            : 'Photo story'}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-1.5">
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <Heart className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">{likes.toLocaleString()}</span>
          </span>
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">{comments.toLocaleString()}</span>
          </span>
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{remaining < 1 ? '<1h left' : `${Math.round(remaining)}h left`}</span>
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {isText && (
          <button
            onClick={() => onEdit(story)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            title="Edit story"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(story)}
          className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
          title="Delete story"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── My Stories Stats ─────────────────────────────────────────────────────────

function MyStoriesStats({ stories }: { stories: Story[] }) {
  const totalLikes = stories.reduce((sum, s) => sum + (s.likes_count ?? 0), 0);
  const totalComments = stories.reduce((sum, s) => sum + (s.comments_count ?? 0), 0);

  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      {[
        { label: 'Stories', value: stories.length, icon: Layers, color: 'text-primary' },
        { label: 'Total Likes', value: totalLikes, icon: Heart, color: 'text-rose-400' },
        { label: 'Comments', value: totalComments, icon: MessageCircle, color: 'text-blue-400' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-card/60 border border-border/50 rounded-2xl p-4 text-center">
          <Icon className={cn('h-5 w-5 mx-auto mb-1.5', color)} />
          <div className="text-xl font-bold text-foreground">{value.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Edit Story Dialog ────────────────────────────────────────────────────────

function EditStoryDialog({
  story,
  open,
  onOpenChange,
}: {
  story: Story | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [gradientId, setGradientId] = useState('neon');

  useEffect(() => {
    if (story) {
      setText(story.content ?? '');
      const gid = story.media_type?.startsWith('text:')
        ? story.media_type.slice('text:'.length)
        : 'neon';
      setGradientId(gid);
    }
  }, [story]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!story) return;
      const { error } = await supabase
        .from('user_statuses')
        .update({
          content: text.trim(),
          media_type: encodeTextStoryType(gradientId),
        })
        .eq('id', story.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories-grid'] });
      queryClient.invalidateQueries({ queryKey: ['my-stories'] });
      onOpenChange(false);
      toast({ title: 'Story updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to update story', description: err.message, variant: 'destructive' });
    },
  });

  const currentGradient = STORY_GRADIENTS.find((g) => g.id === gradientId) ?? STORY_GRADIENTS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Story</DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div
          className="relative h-32 rounded-xl overflow-hidden flex items-center justify-center p-4"
          style={{ background: currentGradient.css }}
        >
          <p className="text-white font-bold text-center drop-shadow-md line-clamp-3 text-sm">
            {text || 'Your story text…'}
          </p>
        </div>

        {/* Text */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={180}
          rows={3}
          className="w-full rounded-xl bg-secondary/50 border border-border/50 text-sm px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          placeholder="What's on your mind?"
        />
        <p className="text-[11px] text-muted-foreground text-right -mt-2">{text.length}/180</p>

        {/* Gradient picker */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Background</p>
          <div className="grid grid-cols-9 gap-1.5">
            {STORY_GRADIENTS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGradientId(g.id)}
                className={cn(
                  'relative h-7 rounded-lg overflow-hidden transition-all hover:scale-105',
                  gradientId === g.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '',
                )}
                style={{ background: g.css }}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!text.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Stories() {
  const { user, isLoading: authLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<'community' | 'mine'>('community');
  const [showViewer, setShowViewer] = useState(false);
  const [viewingIndex, setViewingIndex] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);
  const [editTarget, setEditTarget] = useState<Story | null>(null);
  const [myViewerOpen, setMyViewerOpen] = useState(false);
  const [myViewerIndex, setMyViewerIndex] = useState(0);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      nav(`/login?returnTo=${encodeURIComponent(location.pathname)}`);
    }
  }, [authLoading, user]);

  // ── Community stories ──
  const { data: userGroups = [], isLoading: communityLoading } = useQuery({
    queryKey: ['stories-grid'],
    staleTime: 60_000,
    queryFn: async () => {
      const cutoff = subHours(new Date(), 24).toISOString();
      const { data } = await supabase
        .from('user_statuses')
        .select('*')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true });

      if (!data?.length) return [];

      const ids = [...new Set(data.map((s: any) => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', ids);
      const map = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);

      const grouped = new Map<string, any[]>();
      for (const s of data) {
        const arr = grouped.get(s.user_id) || [];
        arr.push(s);
        grouped.set(s.user_id, arr);
      }

      return Array.from(grouped.entries())
        .map(([user_id, stories]) => ({
          user_id,
          profile: map.get(user_id) || { username: 'Unknown' },
          stories,
        }))
        .sort((a, b) => {
          const aLatest = new Date(a.stories[a.stories.length - 1].created_at).getTime();
          const bLatest = new Date(b.stories[b.stories.length - 1].created_at).getTime();
          return bLatest - aLatest;
        });
    },
  });

  // ── My stories ──
  const { data: myStories = [], isLoading: myLoading } = useQuery({
    queryKey: ['my-stories', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user) return [];
      const cutoff = subHours(new Date(), 24).toISOString();
      const { data, error } = await supabase
        .from('user_statuses')
        .select('id, user_id, content, media_url, media_type, created_at, likes_count, comments_count')
        .eq('user_id', user.id)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Story[];
    },
  });

  // My stories viewer groups (single group = current user)
  const myUserGroups = useMemo(() => {
    if (!user || myStories.length === 0) return [];
    return [
      {
        user_id: user.id,
        profile: { username: 'You', avatar_url: user.user_metadata?.avatar_url ?? '' },
        stories: [...myStories].reverse(),
      },
    ];
  }, [user, myStories]);

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (storyId: string) => {
      const { error } = await supabase.from('user_statuses').delete().eq('id', storyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories-grid'] });
      queryClient.invalidateQueries({ queryKey: ['my-stories'] });
      toast({ title: 'Story deleted' });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: 'Failed to delete story', description: err.message, variant: 'destructive' });
    },
  });

  const openStory = (idx: number) => {
    setViewingIndex(idx);
    setShowViewer(true);
  };

  const openMyStory = (idx: number) => {
    setMyViewerIndex(idx);
    setMyViewerOpen(true);
  };

  const tabs = [
    { id: 'community' as const, label: 'Community', icon: Globe },
    { id: 'mine' as const, label: 'My Stories', icon: BarChart3 },
  ];

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
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-secondary/40 rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                tab === t.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.id === 'mine' && myStories.length > 0 && (
                <span className="bg-primary/20 text-primary text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {myStories.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Community tab ── */}
        <AnimatePresence mode="wait">
          {tab === 'community' && (
            <motion.div key="community" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {communityLoading ? (
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
                    <p className="text-sm text-muted-foreground mb-6">
                      Stories from the community will appear here.
                    </p>
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
                            <video
                              src={latestStory.media_url}
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                              muted
                              playsInline
                            />
                          ) : latestStory.media_url ? (
                            <img
                              src={latestStory.media_url}
                              alt=""
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center p-4 text-center opacity-90 group-hover:opacity-100 transition-opacity"
                              style={{
                                background: resolveStoryGradient(latestStory.media_type, idx),
                              }}
                            >
                              <div
                                className="absolute inset-0 opacity-10 pointer-events-none"
                                style={{
                                  backgroundImage:
                                    'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
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

                          {/* Likes badge */}
                          {(latestStory.likes_count ?? 0) > 0 && (
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold text-white flex items-center gap-1 border border-white/10">
                              <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
                              {latestStory.likes_count}
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
                              <div className="text-sm font-semibold text-white truncate">
                                {g.profile?.username}
                              </div>
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
            </motion.div>
          )}

          {/* ── My Stories tab ── */}
          {tab === 'mine' && (
            <motion.div key="mine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {myLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                  ))}
                </div>
              ) : myStories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center gap-4 bg-card/30 rounded-2xl border border-border/50">
                  <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center shadow-inner">
                    <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg mb-1">No active stories</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Stories you create will appear here with their stats.
                    </p>
                    <Button asChild size="lg">
                      <Link to="/stories/new">
                        <Plus className="h-5 w-5 mr-2" />
                        Create Your First Story
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Stats summary */}
                  <MyStoriesStats stories={myStories} />

                  {/* Story list */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-muted-foreground">
                        Active stories ({myStories.length})
                      </p>
                      {myStories.length > 0 && (
                        <button
                          onClick={() => openMyStory(0)}
                          className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
                        >
                          View all <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {myStories.map((story, idx) => (
                      <MyStoryCard
                        key={story.id}
                        story={story}
                        index={idx}
                        onDelete={setDeleteTarget}
                        onEdit={setEditTarget}
                        onView={() => openMyStory(idx)}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Community viewer */}
      {showViewer && userGroups.length > 0 && (
        <StoryViewer
          userGroups={userGroups}
          initialGroupIndex={viewingIndex}
          onClose={() => setShowViewer(false)}
        />
      )}

      {/* My stories viewer */}
      {myViewerOpen && myUserGroups.length > 0 && (
        <StoryViewer
          userGroups={myUserGroups}
          initialGroupIndex={0}
          onClose={() => setMyViewerOpen(false)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>
              This story will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <EditStoryDialog
        story={editTarget}
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
      />
    </SocialLayout>
  );
}

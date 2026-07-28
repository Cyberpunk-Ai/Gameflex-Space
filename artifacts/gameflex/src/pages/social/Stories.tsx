// @ts-nocheck
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { SocialLayout } from '@/components/social/social-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, subHours } from 'date-fns';
import {
  Camera, Plus, Layers, Heart, MessageCircle, Clock,
  Trash2, Pencil, BarChart3, Eye, TrendingUp, Check,
} from 'lucide-react';
import { StoryViewer } from '@/components/social/stories-rail';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import {
  resolveStoryGradient,
  isVideoStory,
  STORY_GRADIENTS,
  encodeTextStoryType,
} from '@/features/stories/gradients';
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

// ─── helpers ─────────────────────────────────────────────────────────────────

function hoursLeft(createdAt: string) {
  const h = 24 - (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  return Math.max(0, h);
}

// ─── Story thumbnail (reused in grid + stats list) ────────────────────────────

function StoryThumb({
  story,
  index,
  className = '',
}: {
  story: any;
  index: number;
  className?: string;
}) {
  const isVid = isVideoStory(story);
  const grad = resolveStoryGradient(story.media_type, index);

  if (isVid) {
    return (
      <video
        src={story.media_url}
        className={cn('w-full h-full object-cover', className)}
        muted
        playsInline
      />
    );
  }
  if (story.media_url) {
    return (
      <img
        src={story.media_url}
        alt=""
        className={cn('w-full h-full object-cover', className)}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={cn('w-full h-full flex items-center justify-center p-2', className)}
      style={{ background: grad }}
    >
      <p className="text-[9px] font-bold text-white text-center line-clamp-3 leading-tight drop-shadow-sm">
        {story.content ?? ''}
      </p>
    </div>
  );
}

// ─── Community story card ─────────────────────────────────────────────────────

function CommunityCard({
  group,
  index,
  onClick,
}: {
  group: any;
  index: number;
  onClick: () => void;
}) {
  const latest = group.stories[group.stories.length - 1];
  const totalLikes = group.stories.reduce((s: number, x: any) => s + (x.likes_count ?? 0), 0);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, delay: index * 0.04 }}
      type="button"
      onClick={onClick}
      className="flex flex-col text-left group cursor-pointer"
    >
      <div className="relative aspect-[9/16] rounded-2xl overflow-hidden mb-2.5 bg-secondary border border-border/40 group-hover:border-primary/60 transition-all duration-200 shadow-md group-hover:shadow-primary/10 group-hover:shadow-lg">
        <StoryThumb story={latest} index={index} />

        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20 pointer-events-none" />

        {/* story count badge */}
        {group.stories.length > 1 && (
          <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1 border border-white/10">
            <Layers className="h-3 w-3" />
            {group.stories.length}
          </div>
        )}

        {/* likes badge */}
        {totalLikes > 0 && (
          <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1 border border-white/10">
            <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
            {totalLikes}
          </div>
        )}

        {/* user info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end gap-2">
          <div
            className="shrink-0 p-[2px] rounded-full"
            style={{
              background: 'linear-gradient(135deg, hsl(142 76% 45%), hsl(180 100% 50%))',
            }}
          >
            <Avatar className="h-8 w-8 border-[1.5px] border-black">
              <AvatarImage src={group.profile?.avatar_url} className="object-cover" />
              <AvatarFallback className="text-[10px] font-bold bg-secondary text-foreground">
                {group.profile?.username?.[0]?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-white truncate drop-shadow-md leading-none mb-0.5">
              {group.profile?.username ?? '—'}
            </p>
            <p className="text-[10px] text-white/70 font-medium">
              {formatDistanceToNow(new Date(latest.created_at))} ago
            </p>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Stats row (my story card) ────────────────────────────────────────────────

function MyStoryRow({
  story,
  index,
  onDelete,
  onEdit,
  onView,
}: {
  story: any;
  index: number;
  onDelete: (s: any) => void;
  onEdit: (s: any) => void;
  onView: () => void;
}) {
  const isText = !story.media_url;
  const likes = story.likes_count ?? 0;
  const comments = story.comments_count ?? 0;
  const remaining = hoursLeft(story.created_at);
  const pct = (remaining / 24) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="flex items-center gap-3 bg-card/50 border border-border/40 rounded-2xl p-3 hover:border-border/70 hover:bg-card/80 transition-all group"
    >
      {/* Thumbnail */}
      <button
        onClick={onView}
        className="relative w-12 h-[72px] shrink-0 rounded-xl overflow-hidden border border-border/30 group-hover:border-primary/40 transition-colors"
        aria-label="Preview"
      >
        <StoryThumb story={story} index={index} />
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye className="h-4 w-4 text-white drop-shadow" />
        </div>
      </button>

      {/* Info + stats */}
      <div className="flex-1 min-w-0">
        {/* caption */}
        <p className="text-[13px] font-semibold text-foreground truncate leading-snug mb-1.5">
          {story.content
            ? story.content.length > 45
              ? story.content.slice(0, 45) + '…'
              : story.content
            : isVideoStory(story)
            ? 'Video story'
            : 'Photo story'}
        </p>

        {/* stats pills */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="flex items-center gap-1 text-[11px] bg-rose-500/10 text-rose-400 font-semibold rounded-full px-2 py-0.5 border border-rose-500/15">
            <Heart className="h-3 w-3" />
            {likes.toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-[11px] bg-blue-500/10 text-blue-400 font-semibold rounded-full px-2 py-0.5 border border-blue-500/15">
            <MessageCircle className="h-3 w-3" />
            {comments.toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-[11px] bg-amber-500/10 text-amber-400 font-semibold rounded-full px-2 py-0.5 border border-amber-500/15">
            <Clock className="h-3 w-3" />
            {remaining < 1 ? '<1h' : `${Math.round(remaining)}h`}
          </span>
        </div>

        {/* expiry progress */}
        <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* action buttons */}
      <div className="flex flex-col gap-1 shrink-0">
        {isText && (
          <button
            onClick={() => onEdit(story)}
            className="p-1.5 rounded-lg hover:bg-primary/15 transition-colors text-muted-foreground hover:text-primary"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(story)}
          className="p-1.5 rounded-lg hover:bg-destructive/15 transition-colors text-muted-foreground hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditDialog({
  story,
  open,
  onOpenChange,
}: {
  story: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [gid, setGid] = useState('neon');

  // sync when story changes
  useMemo(() => {
    if (!story) return;
    setText(story.content ?? '');
    setGid(
      story.media_type?.startsWith('text:')
        ? story.media_type.slice('text:'.length)
        : 'neon',
    );
  }, [story?.id]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!story) return;
      const { error } = await supabase
        .from('user_statuses')
        .update({ content: text.trim(), media_type: encodeTextStoryType(gid) })
        .eq('id', story.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories-grid'] });
      qc.invalidateQueries({ queryKey: ['my-stories'] });
      toast({ title: 'Story updated' });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const grad = STORY_GRADIENTS.find((g) => g.id === gid) ?? STORY_GRADIENTS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit story</DialogTitle>
        </DialogHeader>

        {/* live preview */}
        <div
          className="relative h-28 rounded-xl overflow-hidden flex items-center justify-center p-4"
          style={{ background: grad.css }}
        >
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '18px 18px',
            }}
          />
          <p className="relative text-white font-bold text-center drop-shadow-md line-clamp-3 text-sm">
            {text || 'Your text here…'}
          </p>
        </div>

        {/* text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={180}
          rows={3}
          className="w-full rounded-xl bg-secondary/50 border border-border/50 text-sm px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          placeholder="What's on your mind?"
        />
        <p className="text-[11px] text-muted-foreground text-right -mt-2">{text.length}/180</p>

        {/* gradient */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Background</p>
          <div className="grid grid-cols-9 gap-1.5">
            {STORY_GRADIENTS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGid(g.id)}
                className={cn(
                  'relative h-7 rounded-lg overflow-hidden transition-transform hover:scale-110 active:scale-95',
                  gid === g.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
                style={{ background: g.css }}
              >
                {gid === g.id && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white drop-shadow stroke-[3]" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!text.trim() || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Stories() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showViewer, setShowViewer] = useState(false);
  const [viewingIdx, setViewingIdx] = useState(0);
  const [myViewerOpen, setMyViewerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);

  // ── community stories ──
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
      const profileMap = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);

      const grouped = new Map<string, any[]>();
      for (const s of data) {
        const arr = grouped.get(s.user_id) ?? [];
        arr.push(s);
        grouped.set(s.user_id, arr);
      }

      return Array.from(grouped.entries())
        .map(([uid, stories]) => ({
          user_id: uid,
          profile: profileMap.get(uid) ?? { username: 'Unknown' },
          stories,
        }))
        .sort((a, b) => {
          const aT = new Date(a.stories[a.stories.length - 1].created_at).getTime();
          const bT = new Date(b.stories[b.stories.length - 1].created_at).getTime();
          return bT - aT;
        });
    },
  });

  // ── my stories ──
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
      return data ?? [];
    },
  });

  // viewer groups for my stories
  const myGroups = useMemo(() => {
    if (!user || !myStories.length) return [];
    return [{
      user_id: user.id,
      profile: {
        username: 'You',
        avatar_url: user.user_metadata?.avatar_url ?? '',
      },
      stories: [...myStories].reverse(),
    }];
  }, [user, myStories]);

  // aggregate stats
  const totalLikes = myStories.reduce((s: number, x: any) => s + (x.likes_count ?? 0), 0);
  const totalComments = myStories.reduce((s: number, x: any) => s + (x.comments_count ?? 0), 0);

  // ── delete ──
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_statuses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories-grid'] });
      qc.invalidateQueries({ queryKey: ['my-stories'] });
      toast({ title: 'Story deleted' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

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
      <div className="px-4 md:px-0 space-y-10">

        {/* ──────────── COMMUNITY STORIES ──────────── */}
        <section>
          {communityLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[9/16] rounded-2xl w-full" />
              ))}
            </div>
          ) : userGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-5 bg-card/30 rounded-2xl border border-dashed border-border/50">
              <div className="h-16 w-16 rounded-full bg-secondary/80 flex items-center justify-center">
                <Camera className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <div>
                <p className="font-semibold text-lg">No active stories</p>
                <p className="text-sm text-muted-foreground mt-1 mb-5">
                  Be the first — share a 24-hour highlight with the community.
                </p>
                <Button asChild>
                  <Link to="/stories/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Story
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {userGroups.map((g, idx) => (
                <CommunityCard
                  key={g.user_id}
                  group={g}
                  index={idx}
                  onClick={() => { setViewingIdx(idx); setShowViewer(true); }}
                />
              ))}
            </div>
          )}
        </section>

        {/* ──────────── MY STORIES STATS (logged-in only) ──────────── */}
        {user && (
          <section>
            {/* section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-base tracking-tight">My Stories</h2>
                {myStories.length > 0 && (
                  <span className="bg-primary/15 text-primary text-[11px] font-bold rounded-full px-2 py-0.5">
                    {myStories.length} active
                  </span>
                )}
              </div>
              <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <Link to="/stories/new">
                  <Plus className="h-3.5 w-3.5" />
                  New Story
                </Link>
              </Button>
            </div>

            {myLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[84px] rounded-2xl" />)}
              </div>
            ) : myStories.length === 0 ? (
              <div className="flex items-center gap-4 bg-card/40 border border-dashed border-border/40 rounded-2xl p-5">
                <div className="h-12 w-12 shrink-0 rounded-xl bg-secondary/80 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-semibold">No stories yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create a story to see your likes, comments, and expiry countdown here.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* aggregate stat cards */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Stories', value: myStories.length, icon: Layers, from: 'from-primary/20', text: 'text-primary' },
                    { label: 'Total Likes', value: totalLikes, icon: Heart, from: 'from-rose-500/20', text: 'text-rose-400' },
                    { label: 'Comments', value: totalComments, icon: MessageCircle, from: 'from-blue-500/20', text: 'text-blue-400' },
                  ].map(({ label, value, icon: Icon, from, text }) => (
                    <div
                      key={label}
                      className={cn(
                        'bg-gradient-to-br to-transparent border border-border/40 rounded-2xl p-4 flex flex-col items-center text-center gap-1.5',
                        from,
                      )}
                    >
                      <Icon className={cn('h-5 w-5', text)} />
                      <span className="text-2xl font-extrabold text-foreground tracking-tight">
                        {value.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
                    </div>
                  ))}
                </div>

                {/* per-story rows */}
                <div className="space-y-2.5">
                  {myStories.map((story: any, idx: number) => (
                    <MyStoryRow
                      key={story.id}
                      story={story}
                      index={idx}
                      onDelete={setDeleteTarget}
                      onEdit={setEditTarget}
                      onView={() => { setMyViewerOpen(true); }}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* guest prompt */}
        {!user && (
          <div className="flex items-center gap-4 bg-card/40 border border-primary/20 rounded-2xl p-5">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Track your story stats</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sign in to see likes, comments, and manage your own stories.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── viewers ── */}
      {showViewer && userGroups.length > 0 && (
        <StoryViewer
          userGroups={userGroups}
          initialGroupIndex={viewingIdx}
          onClose={() => setShowViewer(false)}
        />
      )}
      {myViewerOpen && myGroups.length > 0 && (
        <StoryViewer
          userGroups={myGroups}
          initialGroupIndex={0}
          onClose={() => setMyViewerOpen(false)}
        />
      )}

      {/* ── delete confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── edit dialog ── */}
      <EditDialog
        story={editTarget}
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
      />
    </SocialLayout>
  );
}

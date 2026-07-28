import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Gamepad2, Wallet, Trophy, Target, Camera, MessageCircle, Edit, Grid3x3,
  Play, BadgeCheck, Plus, Settings, Loader2, Flame, Coins, ImageOff,
} from 'lucide-react';
import { Link } from '@/lib/router-compat';
import { EditProfileModal } from '@/components/profile/edit-profile-modal';
import { StoryViewer } from '@/components/social/stories-rail';
import { resolveStoryGradient, isVideoStory } from '@/features/stories/gradients';
import { STORAGE_BUCKETS } from '@/integrations/supabase/storage-setup';
import { cn } from '@/lib/utils';

function compact(n: number | null | undefined): string {
  const value = n ?? 0;
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

/** Instagram-style stat pill: big number over a muted label. */
function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center sm:items-start">
      <span className="font-display text-lg sm:text-xl font-bold leading-none">{value}</span>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: 'primary' | 'win' | 'loss' | 'gold';
}) {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 border-primary/20 text-primary',
    win: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
    loss: 'bg-red-500/10 border-red-500/20 text-red-500',
    gold: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
  };
  return (
    <div className={cn('rounded-xl border p-4 flex flex-col gap-2', tones[tone])}>
      <Icon className="h-4 w-4" />
      <p className="font-display text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

const Profile = () => {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const { data: stats } = useQuery({
    queryKey: ['leaderboard-stats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('leaderboard_stats')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['profile-stories', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_statuses')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ['user-registrations', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('registrations')
        .select('*, tournaments(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const clips = useMemo(() => posts.filter((p: any) => isVideoStory(p)), [posts]);

  // Shape the current user's posts for the shared StoryViewer.
  const viewerGroups = useMemo(
    () => (posts.length ? [{ user_id: user?.id ?? '', profile, stories: [...posts].reverse() }] : []),
    [posts, profile, user?.id],
  );

  useEffect(() => {
    if (viewerOpen && posts.length === 0) setViewerOpen(false);
  }, [viewerOpen, posts.length]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Images only', description: 'Pick an image for your avatar.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Avatars are capped at 5 MB.', variant: 'destructive' });
      return;
    }

    setUploadingAvatar(true);
    try {
      const rawExt = file.name.split('.').pop();
      const ext = rawExt && /^[a-z0-9]{1,5}$/i.test(rawExt) ? rawExt.toLowerCase() : 'jpg';
      // Owner-scoped path: storage RLS requires the user id as first segment.
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.AVATARS)
        .upload(filePath, file, { upsert: true, contentType: file.type, cacheControl: '0' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKETS.AVATARS)
        .getPublicUrl(filePath);

      // Cache-bust so the new avatar shows immediately on the same path.
      await updateProfile({ avatar_url: `${publicUrl}?v=${Date.now()}` });
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Avatar updated' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-sm mx-auto text-center rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-8">
          <div
            className="h-16 w-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-primary-foreground shadow-md"
            style={{ background: 'linear-gradient(135deg, hsl(142 76% 45%) 0%, hsl(160 80% 42%) 100%)' }}
          >
            <Gamepad2 className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">Sign in to view your profile</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Track your matches, earnings and highlights in one place.
          </p>
          <Button asChild className="w-full h-11 rounded-xl font-semibold">
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  const bio = (profile as any).bio as string | null;

  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <div className="max-w-4xl mx-auto">
        {/* ── Header ─────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-10 pb-8">
          {/* Avatar with gradient ring */}
          <div className="relative shrink-0 mx-auto sm:mx-0">
            <div
              className="p-[3px] rounded-full"
              style={{ background: 'linear-gradient(135deg, hsl(142 76% 45%), hsl(180 100% 50%), hsl(45 100% 50%))' }}
            >
              <Avatar className="h-24 w-24 sm:h-36 sm:w-36 border-4 border-background">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
                <AvatarFallback className="text-3xl font-display font-bold bg-secondary">
                  {profile.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Change profile photo"
              className="absolute bottom-1 right-1 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Identity + stats */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-5">
              <div className="flex items-center justify-center sm:justify-start gap-2 min-w-0">
                <h1 className="font-display text-xl sm:text-2xl font-bold truncate">{profile.username}</h1>
                {profile.is_verified && (
                  <BadgeCheck className="h-5 w-5 text-primary shrink-0" aria-label="Verified" />
                )}
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Button size="sm" className="h-9 px-4 font-semibold" onClick={() => setShowEditModal(true)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Edit profile
                </Button>
                <Button asChild size="sm" variant="secondary" className="h-9 px-4 font-semibold">
                  <Link to="/stories/new">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    New story
                  </Link>
                </Button>
                <Button asChild size="icon" variant="secondary" className="h-9 w-9">
                  <Link to="/messages" aria-label="Messages">
                    <MessageCircle className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="icon" variant="ghost" className="h-9 w-9">
                  <Link to="/settings" aria-label="Settings">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-8 sm:gap-10 mb-5">
              <StatBlock value={compact(posts.length)} label="posts" />
              <StatBlock value={compact(profile.followers_count)} label="followers" />
              <StatBlock value={compact(profile.following_count)} label="following" />
            </div>

            <div className="space-y-1.5 text-sm">
              {profile.game_handle && (
                <p className="flex items-center justify-center sm:justify-start gap-1.5 font-medium">
                  <Gamepad2 className="h-3.5 w-3.5 text-primary" />
                  {profile.game_handle}
                </p>
              )}
              {bio && <p className="whitespace-pre-wrap text-muted-foreground max-w-prose">{bio}</p>}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <Badge variant="secondary" className="gap-1 font-medium">
                  <Coins className="h-3 w-3" />
                  KES {profile.wallet_balance ?? 0}
                </Badge>
                {stats?.points != null && (
                  <Badge variant="secondary" className="gap-1 font-medium">
                    <Flame className="h-3 w-3" />
                    {stats.points} pts
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Career metrics ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-8">
          <MetricCard icon={Trophy} tone="win" label="Wins" value={String(stats?.wins ?? 0)} />
          <MetricCard icon={Target} tone="loss" label="Losses" value={String(stats?.losses ?? 0)} />
          <MetricCard icon={Flame} tone="primary" label="Points" value={String(stats?.points ?? 0)} />
          <MetricCard icon={Wallet} tone="gold" label="Earnings" value={`KES ${stats?.earnings ?? 0}`} />
        </div>

        {/* ── Tabbed content grid ────────────────────────────── */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full h-auto p-0 bg-transparent border-t border-border/60 rounded-none justify-center gap-10">
            {[
              { value: 'posts', icon: Grid3x3, label: 'Posts' },
              { value: 'clips', icon: Play, label: 'Clips' },
              { value: 'tournaments', icon: Trophy, label: 'Tournaments' },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-t-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none -mt-px px-2 py-3 gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="posts" className="mt-6">
            <PostGrid
              items={posts}
              loading={postsLoading}
              emptyTitle="No posts yet"
              emptyBody="Share a highlight and it will show up here."
              onOpen={(i) => { setViewerIndex(i); setViewerOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="clips" className="mt-6">
            <PostGrid
              items={clips}
              loading={postsLoading}
              emptyTitle="No clips yet"
              emptyBody="Upload a short video story to build your clip reel."
              onOpen={() => { setViewerIndex(0); setViewerOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="tournaments" className="mt-6">
            {registrations.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No tournament history"
                body="Join a tournament to start building your record."
              />
            ) : (
              <div className="space-y-3">
                {registrations.map((reg: any) => (
                  <div
                    key={reg.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl bg-card/60 border border-border/50"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{reg.tournaments?.title ?? 'Tournament'}</p>
                      <p className="text-sm text-muted-foreground">
                        {reg.tournaments?.start_date
                          ? new Date(reg.tournaments.start_date).toLocaleDateString()
                          : 'Date TBA'}
                      </p>
                    </div>
                    <Badge variant={reg.status === 'confirmed' ? 'default' : 'secondary'} className="shrink-0">
                      {reg.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <EditProfileModal open={showEditModal} onOpenChange={setShowEditModal} />

      {viewerOpen && viewerGroups.length > 0 && (
        <StoryViewer
          userGroups={viewerGroups}
          initialGroupIndex={0}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
};

function EmptyState({
  icon: Icon, title, body,
}: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="h-16 w-16 rounded-full border-2 border-border flex items-center justify-center">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-display text-lg font-bold mb-1">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function PostGrid({
  items, loading, emptyTitle, emptyBody, onOpen,
}: {
  items: any[];
  loading: boolean;
  emptyTitle: string;
  emptyBody: string;
  onOpen: (index: number) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-sm sm:rounded-md" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState icon={ImageOff} title={emptyTitle} body={emptyBody} />;
  }

  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2">
      {items.map((item, i) => {
        const video = isVideoStory(item);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(i)}
            className="relative aspect-square overflow-hidden rounded-sm sm:rounded-md bg-secondary group"
          >
            {video ? (
              <video src={item.media_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            ) : item.media_url ? (
              <img src={item.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center p-2 text-center"
                style={{ background: resolveStoryGradient(item.media_type, i) }}
              >
                <p className="font-display text-[11px] sm:text-xs font-bold text-white drop-shadow line-clamp-4">
                  {item.content}
                </p>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
            {video && (
              <Play className="absolute top-2 right-2 h-4 w-4 text-white drop-shadow fill-white" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Profile;

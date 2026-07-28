import { useAuth } from '@/lib/auth-context';
import { Link, useNavigate, useLocation } from '@/lib/router-compat';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SocialLayout } from '@/components/social/social-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Grid3x3, Film, Bookmark, Settings, Play, MoreVertical, QrCode, Heart, MessageCircle, Camera, Plus, Bell, Activity as ActivityIcon, Users, Smartphone, User as UserIcon, Trophy, Zap, Flame, Share2, Radio, Gamepad2, Award, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

export default function SocialProfile() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<'posts' | 'reels' | 'saved'>('posts');

  useEffect(() => {
    if (!authLoading && !user) {
      nav(`/login?returnTo=${encodeURIComponent(location.pathname)}`);
    }
  }, [authLoading, user]); // nav/location excluded — new refs each render

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['my-posts', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_statuses')
        .select('id, media_url, media_type, likes_count, comments_count')
        .eq('user_id', user!.id)
        .not('media_url', 'is', null)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: savedPosts = [] } = useQuery({
    queryKey: ['saved-posts', user?.id],
    enabled: !!user && tab === 'saved',
    queryFn: async () => {
      const { data: saves } = await (supabase as any).from('status_saves').select('status_id').eq('user_id', user!.id);
      if (!saves?.length) return [];
      const ids = (saves as { status_id: string }[]).map((s) => s.status_id);
      const { data: savedData } = await supabase.from('user_statuses').select('id, media_url, media_type, likes_count, comments_count, content').in('id', ids);
      return savedData ?? [];
    }
  });

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ['profile-counts', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const [followers, following, statuses] = await Promise.all([
        supabase.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', user!.id),
        supabase.from('user_follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', user!.id),
        supabase.from('user_statuses').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
      ]);
      return { followers: followers.count ?? 0, following: following.count ?? 0, posts: statuses.count ?? 0 };
    },
  });

  const { data: myStories = [] } = useQuery({
    queryKey: ['my-stories', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('user_statuses')
        .select('*')
        .eq('user_id', user!.id)
        .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString());
      return data ?? [];
    }
  });

  if (authLoading || !user) return null;

  const handleShareProfile = async () => {
    try {
      await navigator.share({ title: profile?.username ?? 'GameFlex', url: window.location.href });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Profile link copied' });
    }
  };

  const handleCopyProfileLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast({ title: 'Profile link copied' });
  };

  const filtered = tab === 'reels'
    ? posts.filter((p: { media_type: string | null }) => p.media_type === 'video')
    : tab === 'saved'
    ? savedPosts
    : posts;

  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <SocialLayout>
      <motion.div
        className="px-0 md:px-4 max-w-4xl mx-auto"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Mobile Header Top Bar (Profile only) */}
        <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur-md z-30">
          <div className="font-semibold text-lg">{profile?.username}</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/notifications"><Bell className="h-5 w-5" /></Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border/50">
                <DropdownMenuItem asChild><Link to="/social/settings"><Settings className="h-4 w-4 mr-2" /> Settings</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav('/saved')}><Film className="h-4 w-4 mr-2" /> Archive</DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav('/activity')}><ActivityIcon className="h-4 w-4 mr-2" /> Your activity</DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyProfileLink}><QrCode className="h-4 w-4 mr-2" /> QR code</DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/saved"><Bookmark className="h-4 w-4 mr-2" /> Saved</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav('/friends')}><Users className="h-4 w-4 mr-2" /> Close Friends</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Desktop & Mobile Profile Info */}
        <motion.header variants={itemVariants} className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12 mb-8 px-4 md:px-0 pt-6 md:pt-0">
          <div className="flex w-full md:w-auto items-center gap-6">
            <Link to="/stories" className="p-1 rounded-full bg-gradient-to-tr from-primary via-accent to-yellow-500 shadow-neon-sm shrink-0 hover:opacity-90 active:scale-95 transition-all" title="View your stories">
              <Avatar className="h-20 w-20 md:h-36 md:w-36 border-4 border-background object-cover">
                <AvatarImage src={profile?.avatar_url ?? ''} className="object-cover" />
                <AvatarFallback className="text-2xl font-bold bg-secondary text-foreground">
                  {(profile?.username ?? 'U').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>

            {/* Mobile Stats (Beside Avatar) */}
            <div className="flex md:hidden flex-1 justify-around text-center">
              <button onClick={() => setTab('posts')} className="flex flex-col active:scale-95 transition-transform">
                <span className="font-bold text-lg">{countsLoading ? '-' : counts?.posts}</span>
                <span className="text-xs text-muted-foreground">posts</span>
              </button>
              <Link to="/friends" className="flex flex-col active:scale-95 transition-transform">
                <span className="font-bold text-lg">{countsLoading ? '-' : counts?.followers}</span>
                <span className="text-xs text-muted-foreground">followers</span>
              </Link>
              <Link to="/friends" className="flex flex-col active:scale-95 transition-transform">
                <span className="font-bold text-lg">{countsLoading ? '-' : counts?.following}</span>
                <span className="text-xs text-muted-foreground">following</span>
              </Link>
            </div>
          </div>

          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-5">
              <h1 className="text-xl font-semibold truncate hidden md:block">{profile?.username ?? 'user'}</h1>

              <div className="flex gap-2 w-full md:w-auto">
                <Button variant="secondary" className="flex-1 md:flex-none font-semibold shadow-sm" asChild>
                  <Link to="/profile">Edit profile</Link>
                </Button>
                <Button variant="secondary" className="flex-1 md:flex-none font-semibold shadow-sm" onClick={handleShareProfile}>
                  Share profile
                </Button>
                <Button variant="ghost" size="icon" className="hidden md:flex" asChild>
                  <Link to="/social/settings"><Settings className="h-5 w-5" /></Link>
                </Button>
              </div>
            </div>

            {/* Desktop Stats */}
            <div className="hidden md:flex gap-8 mb-5 text-base">
              <button onClick={() => setTab('posts')} className="hover:opacity-70 transition-opacity"><span className="font-bold">{countsLoading ? '-' : counts?.posts}</span> posts</button>
              <Link to="/friends" className="hover:opacity-70 transition-opacity"><span className="font-bold">{countsLoading ? '-' : counts?.followers}</span> followers</Link>
              <Link to="/friends" className="hover:opacity-70 transition-opacity"><span className="font-bold">{countsLoading ? '-' : counts?.following}</span> following</Link>
            </div>

            {/* Bio */}
            <div className="text-sm">
              <div className="font-bold mb-1">{(profile as any)?.full_name ?? profile?.username}</div>
              <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {(profile as any)?.bio ?? 'African Gamer\nGameFlex Competitor\nPlay to Win'}
              </p>
            </div>
          </div>
        </motion.header>

        {/* Mobile-only: Quick actions + Player card + Achievements strip */}
        <motion.div variants={itemVariants} className="md:hidden px-4 space-y-4 -mt-2 mb-6">
          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Share2, label: 'Share', onClick: handleShareProfile },
              { icon: Radio, label: 'Go Live', onClick: () => nav('/live') },
              { icon: Trophy, label: 'Tourneys', onClick: () => nav('/tournaments') },
              { icon: Settings, label: 'Settings', onClick: () => nav('/social/settings') },
            ].map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm py-3 active:scale-95 transition-transform"
              >
                <a.icon className="h-4 w-4 text-foreground/80" />
                <span className="text-[11px] font-medium text-foreground/80">{a.label}</span>
              </button>
            ))}
          </div>

          {/* Player level / XP card */}
          <div
            className="rounded-2xl p-4 text-primary-foreground shadow-md relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(142 76% 45%) 0%, hsl(180 70% 42%) 100%)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-widest opacity-80">Player level</div>
                  <div className="font-display font-bold text-lg leading-none">Lvl {Math.max(1, Math.floor((counts?.posts ?? 0) / 3) + 1)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-widest opacity-80">XP</div>
                <div className="font-display font-bold text-lg leading-none">{((counts?.posts ?? 0) * 120 + (counts?.followers ?? 0) * 15).toLocaleString()}</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white/90 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((counts?.posts ?? 0) % 3) * 33 + 10)}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] opacity-80">Post more clips to level up faster</div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Flame, label: 'Streak', value: '7d' },
              { icon: TrendingUp, label: 'Wins', value: '24' },
              { icon: Gamepad2, label: 'Matches', value: '58' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border/50 bg-card/40 p-3 text-center">
                <s.icon className="h-4 w-4 mx-auto mb-1 text-primary" />
                <div className="font-display font-bold text-base leading-none">{s.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Achievements strip */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest">Achievements</span>
              </div>
              <Link to="/activity" className="text-[11px] text-primary font-semibold">See all</Link>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
              {[
                { icon: Trophy, name: 'MVP', color: 'from-yellow-500 to-orange-500' },
                { icon: Flame, name: 'Hot Streak', color: 'from-orange-500 to-red-500' },
                { icon: Zap, name: 'Fast Hands', color: 'from-cyan-400 to-blue-500' },
                { icon: Award, name: 'Verified', color: 'from-emerald-500 to-teal-500' },
                { icon: Gamepad2, name: 'Pro', color: 'from-fuchsia-500 to-purple-500' },
              ].map((b) => (
                <div key={b.name} className="flex flex-col items-center gap-1 shrink-0 w-16">
                  <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${b.color} flex items-center justify-center text-white shadow-sm`}>
                    <b.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight">{b.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Discover more */}
          <div className="grid grid-cols-2 gap-2">
            <Link to="/friends" className="rounded-xl border border-border/50 bg-card/40 p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight truncate">Discover people</div>
                <div className="text-[11px] text-muted-foreground truncate">Find your squad</div>
              </div>
            </Link>
            <Link to="/saved" className="rounded-xl border border-border/50 bg-card/40 p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Bookmark className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight truncate">Saved</div>
                <div className="text-[11px] text-muted-foreground truncate">Your collection</div>
              </div>
            </Link>
          </div>
        </motion.div>

        {/* Story Highlights */}
        <motion.div variants={itemVariants} className="flex gap-4 px-4 md:px-0 mb-8 overflow-x-auto scrollbar-hide pb-2">
          <Link to="/stories/new" className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-full border border-border/60 bg-secondary/20 flex items-center justify-center group-hover:border-primary/50 transition-colors">
              <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-[11px] md:text-xs font-medium">New</span>
          </Link>

          {myStories.map((story: any, i: number) => (
            <Link key={story.id} to="/stories" className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full p-0.5 bg-gradient-to-tr from-primary via-accent to-yellow-500 shadow-sm group-hover:shadow-md transition-shadow">
                <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-secondary">
                  {story.media_url ? (
                    story.media_type === 'video' ? (
                      <video src={story.media_url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={story.media_url} className="w-full h-full object-cover" alt="Story" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold">
                      TEXT
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] md:text-xs font-medium">Story {i + 1}</span>
            </Link>
          ))}

          {['Tournaments', 'Clips', 'Setup'].map((name) => (
            <div key={name} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group opacity-50">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full border border-border/60 bg-secondary/50 p-1 flex items-center justify-center group-hover:border-primary/50 transition-colors">
                <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                  <Camera className="h-6 w-6 text-muted-foreground/50" />
                </div>
              </div>
              <span className="text-[11px] md:text-xs font-medium">{name}</span>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants} className="flex items-center justify-center md:justify-start gap-12 border-t border-border/60">
          {[
            { id: 'posts' as const, label: 'POSTS', icon: Grid3x3 },
            { id: 'reels' as const, label: 'REELS', icon: Film },
            { id: 'saved' as const, label: 'SAVED', icon: Bookmark },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 py-4 text-xs font-bold uppercase tracking-widest border-t-2 -mt-px transition-colors',
                tab === t.id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground/80'
              )}
            >
              <t.icon className="h-4 w-4" /> <span className="hidden md:inline">{t.label}</span>
            </button>
          ))}
        </motion.div>

        {/* Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-0.5 md:gap-2 mt-0.5 md:mt-2">
          {postsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-none md:rounded-md" />
            ))
          ) : filtered.length === 0 ? (
            tab === 'posts' && counts?.posts === 0 ? (
              <div className="col-span-3 py-8 px-4 flex flex-col items-center">
                <h2 className="font-semibold text-lg mb-6">Getting Started</h2>
                <div className="w-full max-w-sm space-y-4">
                  <Card className="p-4 flex gap-4 bg-card shadow-sm border-border/50">
                    <div className="h-10 w-10 shrink-0 rounded-full border-2 border-primary text-primary flex items-center justify-center">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1">Share Photos</h3>
                      <p className="text-xs text-muted-foreground mb-3">When you share photos, they will appear on your profile.</p>
                      <Button size="sm" className="w-full" asChild>
                        <Link to="/create">Share your first photo</Link>
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4 flex gap-4 bg-card shadow-sm border-border/50">
                    <div className="h-10 w-10 shrink-0 rounded-full border-2 border-primary text-primary flex items-center justify-center">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1">Add phone number</h3>
                      <p className="text-xs text-muted-foreground mb-3">Add your phone number so you can reset your password.</p>
                      <Button size="sm" className="w-full" asChild>
                        <Link to="/profile">Add phone number</Link>
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4 flex gap-4 bg-card shadow-sm border-border/50">
                    <div className="h-10 w-10 shrink-0 rounded-full border-2 border-primary text-primary flex items-center justify-center">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1">Add Profile Photo</h3>
                      <p className="text-xs text-muted-foreground mb-3">Add a profile photo so your friends know it's you.</p>
                      <Button size="sm" className="w-full" asChild>
                        <Link to="/profile">Add profile photo</Link>
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="col-span-3 py-24 flex flex-col items-center justify-center text-center px-4">
                <div className="h-16 w-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
                  {tab === 'posts' && <Camera className="h-8 w-8 text-muted-foreground/50" />}
                  {tab === 'reels' && <Film className="h-8 w-8 text-muted-foreground/50" />}
                  {tab === 'saved' && <Bookmark className="h-8 w-8 text-muted-foreground/50" />}
                </div>
                <h2 className="text-xl font-bold mb-2">
                  {tab === 'posts' && 'No Posts Yet'}
                  {tab === 'reels' && 'No Reels'}
                  {tab === 'saved' && "Only you can see what you've saved"}
                </h2>
                <p className="text-muted-foreground text-sm max-w-sm">
                  {tab === 'posts' && 'When you share photos and videos, they will appear on your profile.'}
                  {tab === 'saved' && 'Save photos and videos that you want to see again. No one is notified, and only you can see them.'}
                </p>
              </div>
            )
          ) : (
            filtered.map((p: any) => (
              <Link key={p.id} to={`/post/${p.id}`} className="relative aspect-square bg-secondary group overflow-hidden md:rounded-md block">
                {p.media_type === 'video' ? (
                  <>
                    <video src={p.media_url} className="w-full h-full object-cover" muted playsInline />
                    <Play className="absolute top-2 right-2 h-4 w-4 text-white drop-shadow-md z-10" />
                  </>
                ) : p.media_url ? (
                  <img src={p.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center p-4 text-center"
                    style={{
                      background: [
                        'linear-gradient(135deg, hsl(142 76% 45%) 0%, hsl(200 100% 50%) 100%)',
                        'linear-gradient(135deg, hsl(280 100% 60%) 0%, hsl(330 100% 60%) 100%)',
                        'linear-gradient(135deg, hsl(25 100% 55%) 0%, hsl(0 84% 60%) 100%)',
                        'linear-gradient(135deg, hsl(180 100% 50%) 0%, hsl(280 100% 60%) 100%)'
                      ][p.id.charCodeAt(0) % 4]
                    }}
                  >
                    <span className="font-display font-bold text-xs text-white z-10 line-clamp-3">
                      {p.content}
                    </span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-6 backdrop-blur-[2px] z-20">
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <Heart className="h-5 w-5 fill-white text-white" />
                    <span>{p.likes_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <MessageCircle className="h-5 w-5 fill-white text-white" />
                    <span>{p.comments_count || 0}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </motion.div>
      </motion.div>
    </SocialLayout>
  );
}

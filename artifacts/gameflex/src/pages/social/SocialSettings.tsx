// @ts-nocheck
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Link, useNavigate, useLocation } from '@/lib/router-compat';
import { SocialLayout } from '@/components/social/social-nav';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { 
  Bell, Lock, Eye, Shield, MessageCircle, UserX, Palette, LogOut, 
  ChevronRight, Volume2, Globe, Heart, Gamepad2, ShieldAlert,
  Smartphone, Database, HardDrive, Download, HelpCircle, Info, Key,
  Play, Share2, Sparkles, Plus
} from 'lucide-react';
import { motion } from 'framer-motion';

function Row({ icon: Icon, title, desc, right, onClick, className }: any) {
  return (
    <div className={`flex items-center gap-4 p-4 ${onClick ? 'cursor-pointer hover:bg-secondary/50 transition-colors' : ''} ${className}`} onClick={onClick}>
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate text-foreground">{title}</div>
        {desc && <div className="text-xs text-muted-foreground truncate">{desc}</div>}
      </div>
      {right}
    </div>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3 px-1">{title}</h2>
      <Card className="divide-y divide-border/50 overflow-hidden bg-card/50 border-border/50 shadow-sm">
        {children}
      </Card>
    </section>
  );
}

export default function SocialSettings() {
  const { user, profile, logout, isLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Settings State
  const [activeTab, setActiveTab] = useState('edit-profile');
  const [bio, setBio] = useState(profile?.bio || '');
  const [website, setWebsite] = useState((profile as any)?.website || '');
  const [fullName, setFullName] = useState((profile as any)?.full_name || '');
  const [saving, setSaving] = useState(false);

  // Persisted UI preferences (localStorage-scoped to user)
  const uid = user?.id ?? 'anon';
  const [aiCreator, setAiCreator] = useLocalStorage(`gf:setting:${uid}:ai-creator`, false);
  const [gender, setGender] = useLocalStorage<string>(`gf:setting:${uid}:gender`, 'Prefer not to say');
  const [showSuggestions, setShowSuggestions] = useLocalStorage(`gf:setting:${uid}:show-suggestions`, true);
  const [privateAccount, setPrivateAccount] = useLocalStorage(`gf:setting:${uid}:private`, false);
  const [showActivity, setShowActivity] = useLocalStorage(`gf:setting:${uid}:activity`, true);
  const [pushLikes, setPushLikes] = useLocalStorage(`gf:setting:${uid}:push-likes`, true);
  const [pushFollows, setPushFollows] = useLocalStorage(`gf:setting:${uid}:push-follows`, true);
  const [pushTournaments, setPushTournaments] = useLocalStorage(`gf:setting:${uid}:push-tournaments`, true);
  const [gamingMode, setGamingMode] = useLocalStorage(`gf:setting:${uid}:gaming-mode`, true);
  const [autoplay, setAutoplay] = useLocalStorage(`gf:setting:${uid}:autoplay`, true);
  const [readReceipts, setReadReceipts] = useLocalStorage(`gf:setting:${uid}:read-receipts`, true);
  const [typingIndicator, setTypingIndicator] = useLocalStorage(`gf:setting:${uid}:typing`, true);
  const [matureFilter, setMatureFilter] = useLocalStorage(`gf:setting:${uid}:mature-filter`, true);
  const [reducedMotion, setReducedMotion] = useLocalStorage(`gf:setting:${uid}:reduced-motion`, false);

  useEffect(() => {
    if (!isLoading && !user) {
      nav(`/login?returnTo=${encodeURIComponent(location.pathname)}`);
    }
  }, [isLoading, user]);

  // Sync gaming-mode preference to <html> for CSS to react (optional hook-in)
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.gamingMode = gamingMode ? 'on' : 'off';
    root.dataset.reducedMotion = reducedMotion ? 'on' : 'off';
  }, [gamingMode, reducedMotion]);

  if (isLoading || !user) return null;

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio, full_name: fullName })
        .eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message ?? 'Try again', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const SidebarItem = ({ id, icon: Icon, label }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        activeTab === id 
          ? 'bg-secondary text-foreground' 
          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </button>
  );

  return (
    <SocialLayout title="Settings">
      <div className="max-w-5xl mx-auto md:flex md:gap-8 pb-12 px-4 md:px-0">
        
        {/* Left Sidebar */}
        <div className="md:w-64 shrink-0 flex flex-col gap-6 md:sticky md:top-24 h-max mb-8 md:mb-0 hidden md:flex">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3 px-2">Your account</h3>
            <div className="space-y-1">
              <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                <LogOut className="h-5 w-5 shrink-0" />
                <span>Log out</span>
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3 px-2">How you use the app</h3>
            <div className="space-y-1">
              <SidebarItem id="edit-profile" icon={UserX} label="Edit profile" />
              <SidebarItem id="notifications" icon={Bell} label="Notifications" />
              <SidebarItem id="appearance" icon={Palette} label="Appearance" />
              <SidebarItem id="playback" icon={Play} label="Playback & data" />
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3 px-2">Who can see your content</h3>
            <div className="space-y-1">
              <SidebarItem id="account-privacy" icon={Lock} label="Account privacy" />
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3 px-2">How others can interact</h3>
            <div className="space-y-1">
              <SidebarItem id="messages" icon={MessageCircle} label="Messages and story replies" />
            </div>
          </div>
        </div>

        {/* Mobile selector */}
        <div className="md:hidden mb-6 flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
          <Button variant={activeTab === 'edit-profile' ? 'default' : 'secondary'} size="sm" onClick={() => setActiveTab('edit-profile')}>Edit profile</Button>
          <Button variant={activeTab === 'notifications' ? 'default' : 'secondary'} size="sm" onClick={() => setActiveTab('notifications')}>Notifications</Button>
          <Button variant={activeTab === 'account-privacy' ? 'default' : 'secondary'} size="sm" onClick={() => setActiveTab('account-privacy')}>Privacy</Button>
          <Button variant={activeTab === 'appearance' ? 'default' : 'secondary'} size="sm" onClick={() => setActiveTab('appearance')}>Appearance</Button>
          <Button variant={activeTab === 'playback' ? 'default' : 'secondary'} size="sm" onClick={() => setActiveTab('playback')}>Playback</Button>
          <Button variant={activeTab === 'messages' ? 'default' : 'secondary'} size="sm" onClick={() => setActiveTab('messages')}>Messages</Button>
          <Button variant="secondary" size="sm" onClick={logout} className="text-destructive">Log out</Button>
        </div>

        {/* Right Content */}
        <div className="flex-1 min-w-0 max-w-2xl">
          {activeTab === 'edit-profile' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <h2 className="text-2xl font-bold font-display">Edit profile</h2>
              
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border/50">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border border-border/50">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback>{(profile?.username ?? 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold">{profile?.username}</div>
                    <div className="text-sm text-muted-foreground truncate">{fullName || 'GameFlex user'}</div>
                  </div>
                </div>
                <Button asChild variant="secondary" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to="/profile">Change photo</Link>
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Name</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your display name" className="bg-secondary/20" />
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Website</label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" className="bg-secondary/20" />
                  <p className="text-xs text-muted-foreground mt-2">Add a link to your Twitch, YouTube, or portfolio.</p>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Bio</label>
                  <Textarea 
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)} 
                    placeholder="Bio" 
                    className="bg-secondary/20 min-h-[100px] resize-none"
                    maxLength={150}
                  />
                  <div className="text-xs text-muted-foreground mt-2 text-right">{bio.length} / 150</div>
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">AI Creator</div>
                      <div className="text-xs text-muted-foreground">Identify as an AI creator profile</div>
                    </div>
                  </div>
                  <Switch checked={aiCreator} onCheckedChange={setAiCreator} />
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Gender</label>
                  <select 
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-secondary/20 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option>Prefer not to say</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Custom</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm block">Show account suggestions</div>
                    <div className="text-xs text-muted-foreground">Let others see similar accounts on your profile.</div>
                  </div>
                  <Switch checked={showSuggestions} onCheckedChange={setShowSuggestions} />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button size="lg" className="w-full md:w-auto font-semibold" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <h2 className="text-2xl font-bold font-display mb-6">Notifications</h2>
              <Section title="Push Notifications">
                <Row icon={Heart} title="Likes & Comments" right={<Switch checked={pushLikes} onCheckedChange={setPushLikes} />} />
                <Row icon={Bell} title="New Followers" right={<Switch checked={pushFollows} onCheckedChange={setPushFollows} />} />
                <Row icon={Gamepad2} title="Tournament Updates" desc="Match starts, brackets, results" right={<Switch checked={pushTournaments} onCheckedChange={setPushTournaments} />} />
              </Section>
              <p className="text-xs text-muted-foreground px-1">Preferences save automatically to this device.</p>
            </motion.div>
          )}

          {activeTab === 'account-privacy' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <h2 className="text-2xl font-bold font-display mb-6">Account privacy</h2>
              <Section title="Visibility">
                <Row icon={Lock} title="Private account" desc="Only approved followers see your posts" right={<Switch checked={privateAccount} onCheckedChange={setPrivateAccount} />} />
                <Row icon={Eye} title="Activity status" desc="Show when you're online" right={<Switch checked={showActivity} onCheckedChange={setShowActivity} />} />
                <Row icon={ShieldAlert} title="Mature content filter" desc="Hide sensitive content in the feed" right={<Switch checked={matureFilter} onCheckedChange={setMatureFilter} />} />
              </Section>
              <Section title="Safety">
                <Row icon={UserX} title="Blocked accounts" desc="Manage who you've blocked" onClick={() => nav('/friends')} right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
                <Row icon={Key} title="Change password" desc="Update your account password" onClick={() => nav('/profile')} right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
              </Section>
            </motion.div>
          )}

          {activeTab === 'appearance' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <h2 className="text-2xl font-bold font-display mb-6">Appearance</h2>
              <Section title="Theme">
                <Row icon={Palette} title="Theme" desc="Dark (Default)" right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
                <Row icon={Volume2} title="Gaming Mode" desc="Enable neon glow and animations" right={<Switch checked={gamingMode} onCheckedChange={setGamingMode} />} />
                <Row icon={Sparkles} title="Reduce motion" desc="Minimize animations across the app" right={<Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />} />
              </Section>
            </motion.div>
          )}

          {activeTab === 'playback' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <h2 className="text-2xl font-bold font-display mb-6">Playback & data</h2>
              <Section title="Video">
                <Row icon={Play} title="Autoplay videos" desc="Play videos as you scroll" right={<Switch checked={autoplay} onCheckedChange={setAutoplay} />} />
              </Section>
            </motion.div>
          )}

          {activeTab === 'messages' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <h2 className="text-2xl font-bold font-display mb-6">Messages</h2>
              <Section title="Chat behaviour">
                <Row icon={Eye} title="Read receipts" desc="Let people know when you've read their messages" right={<Switch checked={readReceipts} onCheckedChange={setReadReceipts} />} />
                <Row icon={MessageCircle} title="Typing indicator" desc="Show when you're typing" right={<Switch checked={typingIndicator} onCheckedChange={setTypingIndicator} />} />
              </Section>
            </motion.div>
          )}

          {/* Catch-all for other tabs */}
          {!['edit-profile', 'notifications', 'account-privacy', 'appearance', 'playback', 'messages'].includes(activeTab) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center border rounded-2xl bg-secondary/10">
              <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Section in development</h3>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                This settings category is currently being updated for the new GameFlex layout.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </SocialLayout>
  );
}
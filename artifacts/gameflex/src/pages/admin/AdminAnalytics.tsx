// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatsChart } from '@/components/stats-chart';
import { Users, Trophy, DollarSign, TrendingUp, Globe, Activity, Target, Repeat } from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function AdminAnalytics() {
  // Executive KPIs
  const { data: kpis } = useQuery({
    queryKey: ['exec-kpis'],
    queryFn: async () => {
      const now = new Date();
      const dayAgo = subDays(now, 1).toISOString();
      const weekAgo = subDays(now, 7).toISOString();
      const monthAgo = subDays(now, 30).toISOString();
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const [
        { count: totalUsers },
        { count: liveTournaments },
        { data: revToday },
        { data: revWeek },
        { data: revMonth },
        // Use recent registrations as active-user proxy (analytics_events may not be provisioned yet)
        { data: recentRegs30 },
        { data: recentRegs7 },
        { data: recentRegs1 },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('payments').select('amount').eq('status', 'verified').gte('created_at', dayAgo),
        supabase.from('payments').select('amount').eq('status', 'verified').gte('created_at', weekAgo),
        supabase.from('payments').select('amount').eq('status', 'verified').gte('created_at', monthAgo),
        supabase.from('registrations').select('user_id').gte('created_at', monthAgo),
        supabase.from('registrations').select('user_id').gte('created_at', weekAgo),
        supabase.from('registrations').select('user_id').gte('created_at', thirtyMinAgo),
      ]);

      const sum = (rows?: { amount: number | string }[]) =>
        rows?.reduce((s, r) => s + Number(r.amount), 0) ?? 0;

      // Online users = unique registrants in last 30 min (proxy; no real presence tracking yet)
      const usersOnline = new Set((recentRegs1 ?? []).map((r: any) => r.user_id).filter(Boolean)).size;
      const mau = new Set((recentRegs30 ?? []).map((r: any) => r.user_id).filter(Boolean)).size;
      const wau = new Set((recentRegs7 ?? []).map((r: any) => r.user_id).filter(Boolean)).size;
      const retention = mau > 0 ? Math.round((wau / mau) * 100) : 0;

      return {
        totalUsers: totalUsers ?? 0,
        usersOnline,
        liveTournaments: liveTournaments ?? 0,
        revToday: sum(revToday as any),
        revWeek: sum(revWeek as any),
        revMonth: sum(revMonth as any),
        retention,
        mau,
      };
    },
    refetchInterval: 60_000,
  });

  // Revenue trend (30 days)
  const { data: revenueTrend = [] } = useQuery({
    queryKey: ['exec-revenue-trend'],
    queryFn: async () => {
      const days = 30;
      const start = subDays(new Date(), days);
      const { data } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('status', 'verified')
        .gte('created_at', start.toISOString());
      const buckets: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        buckets[format(subDays(new Date(), days - 1 - i), 'MMM dd')] = 0;
      }
      data?.forEach((p: any) => {
        const k = format(new Date(p.created_at), 'MMM dd');
        if (buckets[k] !== undefined) buckets[k] += Number(p.amount);
      });
      return Object.entries(buckets).map(([name, value]) => ({ name, value }));
    },
  });

  // Fastest growing games (by tournament registrations in last 7d)
  const { data: fastGames = [] } = useQuery({
    queryKey: ['exec-fast-games'],
    queryFn: async () => {
      const weekAgo = subDays(new Date(), 7).toISOString();
      const { data } = await supabase
        .from('registrations')
        .select('tournaments(game)')
        .gte('created_at', weekAgo);
      const counts: Record<string, number> = {};
      data?.forEach((r: any) => {
        const g = r.tournaments?.game ?? 'Unknown';
        counts[g] = (counts[g] ?? 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));
    },
  });

  // Top revenue tournaments
  const { data: topTournaments = [] } = useQuery({
    queryKey: ['exec-top-tournaments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('id, title, entry_fee, current_participants, prize_pool')
        .order('current_participants', { ascending: false })
        .limit(5);
      return (data ?? []).map((t: any) => ({
        ...t,
        revenue: Number(t.entry_fee ?? 0) * Number(t.current_participants ?? 0),
      }));
    },
  });

  // Top spenders
  const { data: topSpenders = [] } = useQuery({
    queryKey: ['exec-top-spenders'],
    queryFn: async () => {
      const { data: payments } = await supabase
        .from('payments')
        .select('user_id, amount')
        .eq('status', 'verified');
      const totals: Record<string, number> = {};
      payments?.forEach((p: any) => {
        totals[p.user_id] = (totals[p.user_id] ?? 0) + Number(p.amount);
      });
      const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (top.length === 0) return [];
      const ids = top.map(([id]) => id);
      const { data: profs } = await supabase.from('profiles').select('user_id, username').in('user_id', ids);
      const nameMap = new Map(profs?.map((p: any) => [p.user_id, p.username]) ?? []);
      return top.map(([id, total]) => ({ username: nameMap.get(id) ?? 'Unknown', total }));
    },
  });

  // Fastest growing countries — derived from profiles.country (no analytics_events needed)
  const { data: fastCountries = [] } = useQuery({
    queryKey: ['exec-fast-countries'],
    queryFn: async () => {
      const weekAgo = subDays(new Date(), 7).toISOString();
      const { data } = await supabase
        .from('profiles')
        .select('country')
        .gte('created_at', weekAgo)
        .not('country', 'is', null);
      const counts: Record<string, number> = {};
      data?.forEach((r: any) => {
        const c = r.country ?? 'Unknown';
        counts[c] = (counts[c] ?? 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
    },
  });

  // Acquisition channels — derived from profiles.referral_source when available
  const { data: acquisition = [] } = useQuery({
    queryKey: ['exec-acquisition'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('referral_source')
        .not('referral_source', 'is', null)
        .limit(1000);
      const counts: Record<string, number> = {};
      data?.forEach((r: any) => {
        const src = r.referral_source ?? 'direct';
        counts[src] = (counts[src] ?? 0) + 1;
      });
      if (Object.keys(counts).length === 0) return [{ name: 'organic', value: 1 }];
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
    },
  });

  const kes = (n: number) => `KES ${n.toLocaleString()}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Executive Analytics</h1>
        <p className="text-sm text-muted-foreground">The 20% of data that answers 80% of the questions.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi icon={Activity} color="text-green-500" label="Users online (30m)" value={kpis?.usersOnline ?? 0} />
        <Kpi icon={Trophy} color="text-yellow-500" label="Live tournaments" value={kpis?.liveTournaments ?? 0} />
        <Kpi icon={Users} color="text-primary" label="Total users" value={(kpis?.totalUsers ?? 0).toLocaleString()} />
        <Kpi icon={Repeat} color="text-blue-500" label="W/M retention" value={`${kpis?.retention ?? 0}%`} />
        <Kpi icon={DollarSign} color="text-green-500" label="Revenue today" value={kes(kpis?.revToday ?? 0)} />
        <Kpi icon={DollarSign} color="text-green-500" label="Revenue 7d" value={kes(kpis?.revWeek ?? 0)} />
        <Kpi icon={DollarSign} color="text-green-500" label="Revenue 30d" value={kes(kpis?.revMonth ?? 0)} />
        <Kpi icon={Target} color="text-purple-500" label="MAU" value={(kpis?.mau ?? 0).toLocaleString()} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Revenue (30 days)" icon={TrendingUp}>
          <StatsChart data={revenueTrend} type="area" primaryColor="hsl(142, 76%, 45%)" />
        </Panel>
        <Panel title="Fastest growing games (7d joins)" icon={Trophy}>
          {fastGames.length ? (
            <StatsChart data={fastGames} type="bar" primaryColor="hsl(45, 100%, 55%)" />
          ) : <Empty label="No tournament joins tracked yet" />}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel title="Top revenue tournaments" icon={Trophy}>
          {topTournaments.length ? (
            <ul className="space-y-2">
              {topTournaments.map((t: any) => (
                <li key={t.id} className="flex justify-between text-sm p-2 rounded bg-secondary/50">
                  <span className="truncate mr-2">{t.title}</span>
                  <span className="font-semibold">{kes(t.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty label="No tournaments yet" />}
        </Panel>
        <Panel title="Top spenders" icon={DollarSign}>
          {topSpenders.length ? (
            <ul className="space-y-2">
              {topSpenders.map((s: any) => (
                <li key={s.username} className="flex justify-between text-sm p-2 rounded bg-secondary/50">
                  <span>{s.username}</span>
                  <span className="font-semibold">{kes(s.total)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty label="No verified payments yet" />}
        </Panel>
        <Panel title="Fastest growing countries (7d)" icon={Globe}>
          {fastCountries.length ? (
            <ul className="space-y-2">
              {fastCountries.map((c: any) => (
                <li key={c.name} className="flex justify-between text-sm p-2 rounded bg-secondary/50">
                  <span>{c.name}</span>
                  <span className="font-semibold">{c.value}</span>
                </li>
              ))}
            </ul>
          ) : <Empty label="Country data will appear as signups roll in" />}
        </Panel>
        <Panel title="Best acquisition channels" icon={TrendingUp}>
          {acquisition.length ? (
            <ul className="space-y-2">
              {acquisition.map((a: any) => (
                <li key={a.name} className="flex justify-between text-sm p-2 rounded bg-secondary/50">
                  <span>{a.name}</span>
                  <span className="font-semibold">{a.value}</span>
                </li>
              ))}
            </ul>
          ) : <Empty label="Waiting for session data" />}
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, color, label, value }: any) {
  return (
    <div className="rounded-xl bg-card border border-border/50 p-4">
      <Icon className={`h-5 w-5 mb-2 ${color}`} />
      <div className="font-display text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: any) {
  return (
    <div className="rounded-xl bg-card border border-border/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold">{title}</h2>
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{label}</p>;
}
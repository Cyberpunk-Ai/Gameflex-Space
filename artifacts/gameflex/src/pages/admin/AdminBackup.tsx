// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Database, Download, Upload, RefreshCw, Shield, AlertTriangle, 
  CheckCircle2, Clock, FileJson, FileText, HardDrive, Loader2,
  Table as TableIcon, Trash2, Eye
} from 'lucide-react';
import { exportAsJSON, exportAsCSV, getExportFilename } from '@/utils/export';
import { toast } from 'sonner';
import { format } from 'date-fns';

const EXPORTABLE_TABLES = [
  { key: 'profiles', label: 'Users / Profiles', icon: '👤', sensitive: false },
  { key: 'tournaments', label: 'Tournaments', icon: '🏆', sensitive: false },
  { key: 'matches', label: 'Matches', icon: '🎮', sensitive: false },
  { key: 'payments', label: 'Payments', icon: '💳', sensitive: true },
  { key: 'registrations', label: 'Registrations', icon: '📋', sensitive: false },
  { key: 'user_statuses', label: 'Posts / Statuses', icon: '📝', sensitive: false },
  { key: 'marketplace_listings', label: 'Marketplace', icon: '🛒', sensitive: false },
  { key: 'achievements', label: 'Achievements', icon: '🏅', sensitive: false },
];

const RESTORABLE_TABLES = ['profiles', 'tournaments', 'matches', 'registrations', 'achievements'];

export default function AdminBackup() {
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const lastExport = localStorage.getItem('gameflex_last_export');

  // Table row counts
  const { data: counts = {}, refetch: refetchCounts, isLoading: countsLoading } = useQuery({
    queryKey: ['admin-table-counts'],
    queryFn: async () => {
      const results = await Promise.all(
        EXPORTABLE_TABLES.map(async (t) => {
          const { count } = await supabase.from(t.key as any).select('*', { count: 'exact', head: true });
          return [t.key, count ?? 0];
        })
      );
      return Object.fromEntries(results);
    }
  });

  const handleExport = async (table: string, format: 'json' | 'csv') => {
    setExporting(table + '_' + format);
    try {
      const { data, error } = await supabase.from(table as any).select('*');
      if (error) throw error;
      const filename = getExportFilename(table, format);
      if (format === 'json') exportAsJSON(data, filename);
      else exportAsCSV(data ?? [], filename);
      localStorage.setItem('gameflex_last_export', new Date().toISOString());
      toast.success('Exported ' + (data?.length ?? 0) + ' rows from ' + table);
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(null);
    }
  };

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const snapshot: Record<string, any[]> = {};
      for (const t of EXPORTABLE_TABLES) {
        const { data } = await supabase.from(t.key as any).select('*');
        snapshot[t.key] = data ?? [];
      }
      exportAsJSON({ exported_at: new Date().toISOString(), tables: snapshot }, getExportFilename('full_backup', 'json'));
      localStorage.setItem('gameflex_last_export', new Date().toISOString());
      toast.success('Full backup exported successfully');
    } catch (err: any) {
      toast.error('Backup failed: ' + err.message);
    } finally {
      setExportingAll(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setImportPreview(json);
    } catch {
      toast.error('Invalid JSON file');
      setImportFile(null);
    }
  };

  const handleRestore = async () => {
    if (!importPreview?.tables) { toast.error('Invalid backup format'); return; }
    setRestoring(true);
    try {
      let restored = 0;
      for (const table of RESTORABLE_TABLES) {
        const rows = importPreview.tables[table];
        if (!rows?.length) continue;
        const { error } = await supabase.from(table as any).upsert(rows, { onConflict: 'id' });
        if (!error) restored += rows.length;
      }
      toast.success('Restored ' + restored + ' records');
      setImportPreview(null);
      setImportFile(null);
    } catch (err: any) {
      toast.error('Restore failed: ' + err.message);
    } finally {
      setRestoring(false);
    }
  };

  const totalRows = Object.values(counts as Record<string, number>).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" /> Backup & Export
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Export platform data and manage backups</p>
        </div>
        <div className="flex items-center gap-3">
          {lastExport && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Last export: {format(new Date(lastExport), 'MMM d, HH:mm')}
            </div>
          )}
          <Button onClick={handleExportAll} disabled={exportingAll}>
            {exportingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Full Backup
          </Button>
        </div>
      </div>

      {/* Health overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <div className="font-bold text-lg">{totalRows.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Records</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <TableIcon className="h-8 w-8 text-blue-500" />
            <div>
              <div className="font-bold text-lg">{EXPORTABLE_TABLES.length}</div>
              <div className="text-xs text-muted-foreground">Tables</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-500" />
            <div>
              <div className="font-bold text-lg">Supabase</div>
              <div className="text-xs text-muted-foreground">Auto daily backup</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <HardDrive className="h-8 w-8 text-orange-500" />
            <div>
              <div className="font-bold text-lg">~{Math.round(totalRows * 0.5)}KB</div>
              <div className="text-xs text-muted-foreground">Est. data size</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-table exports */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><FileJson className="h-5 w-5" /> Table Exports</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetchCounts()}>
              <RefreshCw className={countsLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </Button>
          </div>
          <CardDescription>Export individual tables as JSON or CSV</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {EXPORTABLE_TABLES.map(table => {
              const count = (counts as any)[table.key] ?? 0;
              const isExporting = exporting?.startsWith(table.key);
              return (
                <div key={table.key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{table.icon}</span>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {table.label}
                        {table.sensitive && <Badge variant="destructive" className="text-[10px] h-4">Sensitive</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{count.toLocaleString()} records</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={!!isExporting} onClick={() => handleExport(table.key, 'json')}>
                      {isExporting && exporting?.includes('json') ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileJson className="h-3 w-3" />}
                      <span className="ml-1">JSON</span>
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!isExporting} onClick={() => handleExport(table.key, 'csv')}>
                      {isExporting && exporting?.includes('csv') ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                      <span className="ml-1">CSV</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Automated backup info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Shield className="h-8 w-8 text-primary shrink-0 mt-1" />
            <div>
              <h3 className="font-bold mb-1">Automated Backups</h3>
              <p className="text-sm text-muted-foreground mb-3">Supabase automatically backs up your database daily on Pro plans. Point-in-time recovery is available for the last 7 days on Pro and 30 days on Enterprise.</p>
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">Open Supabase Dashboard ↗</Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import / Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-5 w-5" /> Import / Restore</CardTitle>
          <CardDescription>Restore data from a previously exported JSON backup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
            <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" id="import-input" />
            <label htmlFor="import-input" className="cursor-pointer">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click to select a backup JSON file</p>
              <p className="text-xs text-muted-foreground">Only GameFlex backup files are supported</p>
            </label>
          </div>

          {importPreview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                <p className="text-sm text-orange-500">This will upsert records into the database. Existing records with matching IDs will be overwritten. Payments cannot be restored.</p>
              </div>
              <div className="rounded-lg border border-border/50 divide-y divide-border/30">
                {Object.entries(importPreview.tables ?? {}).map(([table, rows]: any) => (
                  <div key={table} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium">{table}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={RESTORABLE_TABLES.includes(table) ? 'default' : 'secondary'}>
                        {RESTORABLE_TABLES.includes(table) ? 'Will restore' : 'Skipped'}
                      </Badge>
                      <span className="text-muted-foreground">{rows.length} rows</span>
                    </div>
                  </div>
                ))}
              </div>
              {importPreview.exported_at && (
                <p className="text-xs text-muted-foreground">Backup from: {format(new Date(importPreview.exported_at), 'PPpp')}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setImportPreview(null); setImportFile(null); }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Cancel
                </Button>
                <Button onClick={handleRestore} disabled={restoring}>
                  {restoring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Restore Data
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

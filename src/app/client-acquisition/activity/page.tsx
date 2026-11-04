'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActivityEvent, ActivityType } from '@/lib/acqOverview';
import { ActivityRows } from '@/components/acq/RecentActivity';
import { Card, EmptyState, Skeleton } from '@/components/acq/ui';

const TABS: Array<{ id: ActivityType | 'all'; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'sent', label: 'Sent' }, { id: 'followup', label: 'Follow-ups' }, { id: 'opened', label: 'Opened' },
  { id: 'clicked', label: 'Clicked' }, { id: 'replied', label: 'Replies' }, { id: 'imported', label: 'Imports' },
];

export default function ActivityPage() {
  const [tab, setTab] = useState<ActivityType | 'all'>('all');
  const [real, setReal] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/client-acquisition/activity?limit=300');
      const json = await res.json() as { events?: ActivityEvent[]; error?: string };
      if (!res.ok) { setError(json.error ?? 'Could not load activity.'); return; }
      setReal(json.events ?? []); setError('');
    } catch { setError('Could not load activity.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const events = real;
  const shown = useMemo(() => (events ?? []).filter((e) => tab === 'all' || e.type === tab), [events, tab]);
  const count = (id: string) => (events ?? []).filter((e) => id === 'all' || e.type === id).length;

  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">Email Activity</h1>
        <p className="acq-sub" style={{ marginTop: 2 }}>Every send, open, click, reply and import, newest first.</p>
      </div>
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {TABS.map((t) => <button key={t.id} className={`acq-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label} <span style={{ opacity: .7 }}>{count(t.id)}</span></button>)}
        </div>
        {error && <p className="acq-warn">{error}</p>}
        {!events && !error ? <div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h={22} />)}</div>
          : shown.length === 0 ? <EmptyState title="Nothing here yet" body="Activity appears as soon as you import leads and run a campaign." />
          : <ActivityRows events={shown} />}
      </Card>
    </div>
  );
}

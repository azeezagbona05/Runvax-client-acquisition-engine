'use client';

import { useMemo, useState } from 'react';
import { useAcq } from '@/components/acq/AcqProvider';
import AcqActions from '@/components/acq/AcqActions';
import CampaignList from '@/components/acq/CampaignList';
import { Card, EmptyState, Skeleton } from '@/components/acq/ui';

const TABS = [
  { id: 'all', label: 'All' }, { id: 'running', label: 'Running' }, { id: 'scheduled', label: 'Scheduled' },
  { id: 'paused', label: 'Paused' }, { id: 'draft', label: 'Not started' }, { id: 'completed', label: 'Finished' },
];

export default function CampaignsPage() {
  const { data, reload } = useAcq();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState('');

  const rows = useMemo(() => (data?.campaigns ?? []).filter((c) => (tab === 'all' || c.status === tab) && (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()))), [data, tab, q]);
  const count = (id: string) => (id === 'all' ? data?.campaigns.length ?? 0 : data?.campaigns.filter((c) => c.status === id).length ?? 0);

  return (
    <div className="acq-stack">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
        <div>
          <h1 className="acq-page-title">Campaigns</h1>
          <p className="acq-sub" style={{ marginTop: 2 }}>Every pitch you&apos;ve sent or planned, and how it&apos;s performing.</p>
        </div>
        <AcqActions onNotice={setNotice} />
      </div>
      {notice && <div className="acq-notice" role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{notice}</span><button className="acq-link" style={{ color: '#64748b' }} onClick={() => setNotice('')}>Dismiss</button></div>}

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {TABS.filter((t) => t.id === 'all' || count(t.id) > 0).map((t) => (
            <button key={t.id} className={`acq-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label} <span style={{ opacity: .7 }}>{count(t.id)}</span></button>
          ))}
          <input className="acq-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns…" aria-label="Search campaigns" style={{ marginLeft: 'auto', width: 240, height: 36 }} />
        </div>
        {!data ? <div style={{ display: 'grid', gap: 18, paddingTop: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={52} />)}</div>
          : rows.length === 0 ? <EmptyState title={data.campaigns.length ? 'No campaigns match' : 'No campaigns yet'} body={data.campaigns.length ? 'Try a different filter or search.' : 'Upload a CSV of leads, write your pitch and press Run.'} />
          : <CampaignList rows={rows} onChanged={() => void reload()} />}
      </Card>
    </div>
  );
}

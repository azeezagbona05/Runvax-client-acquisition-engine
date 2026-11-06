'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { timeAgoShort, type LeadListStage } from '@/lib/acqOverview';
import AcqActions from '@/components/acq/AcqActions';
import ProspectFinder from '@/components/acq/ProspectFinder';
import { BizLogo, Card, EmptyState, Pill, Skeleton } from '@/components/acq/ui';

interface LeadRow { id: string; campaignId: string; campaignName: string; email: string; name: string | null; business: string | null; website: string | null; stage: Exclude<LeadListStage, 'all'>; opens: number; lastActivityAt: string }
interface Resp { total: number; page: number; pageSize: number; counts: Record<string, number>; campaigns: Array<{ id: string; name: string }>; leads: LeadRow[] }

const TABS: Array<{ id: LeadListStage; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'queued', label: 'Queued' }, { id: 'sent', label: 'Sent' }, { id: 'opened', label: 'Opened' },
  { id: 'clicked', label: 'Clicked' }, { id: 'replied', label: 'Replied' }, { id: 'interested', label: 'Interested' }, { id: 'failed', label: 'Failed' }, { id: 'unsubscribed', label: 'Unsubscribed' },
];
const LABEL: Record<string, string> = { queued: 'Queued', sent: 'Sent', opened: 'Opened', clicked: 'Clicked', replied: 'Replied', interested: 'Interested', failed: 'Failed', unsubscribed: 'Unsubscribed' };

function LeadsInner() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [stage, setStage] = useState<LeadListStage>('all');
  const [campaign, setCampaign] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [finder, setFinder] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ stage, page: String(page), ...(q.trim() ? { q: q.trim() } : {}), ...(campaign ? { campaign } : {}) });
      const res = await fetch(`/api/client-acquisition/leads?${qs}`);
      const json = await res.json() as Resp & { error?: string };
      if (!res.ok) { setError(json.error ?? 'Could not load your leads.'); return; }
      setData(json); setError('');
    } catch { setError('Could not load your leads.'); }
  }, [q, stage, campaign, page]);

  useEffect(() => { const t = setTimeout(() => void load(), q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="acq-stack">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
        <div>
          <h1 className="acq-page-title">Lead Lists</h1>
          <p className="acq-sub" style={{ marginTop: 2 }}>Everyone you&apos;ve uploaded or found, across all campaigns. Press Find prospects to search for new businesses.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="acq-btn" style={{ height: 44, padding: '0 20px' }} aria-expanded={finder} onClick={() => setFinder((v) => !v)}><MapPin size={17} /> Find prospects</button>
          <AcqActions hideNew onNotice={(m) => { setNotice(m); void load(); }} />
        </div>
      </div>
      {finder && <ProspectFinder onAdded={(m) => { setNotice(m); void load(); }} />}
      {notice && <div className="acq-notice" role="status">{notice}</div>}

      <Card pad={false}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid #eef2f8' }}>
          {TABS.filter((t) => t.id === 'all' || (data?.counts[t.id] ?? 0) > 0 || stage === t.id).map((t) => (
            <button key={t.id} className={`acq-tab${stage === t.id ? ' active' : ''}`} onClick={() => { setStage(t.id); setPage(1); }}>{t.label} <span style={{ opacity: .7 }}>{data?.counts[t.id] ?? 0}</span></button>
          ))}
          <select className="acq-select" aria-label="Campaign" value={campaign} onChange={(e) => { setCampaign(e.target.value); setPage(1); }} style={{ marginLeft: 'auto', width: 200, height: 36 }}>
            <option value="">All campaigns</option>
            {data?.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="acq-input" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search leads…" aria-label="Search leads" style={{ width: 220, height: 36 }} />
        </div>
        {error && <p className="acq-warn" style={{ margin: 16 }}>{error}</p>}
        {!data && !error ? <div style={{ display: 'grid', gap: 14, padding: 18 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={30} />)}</div>
          : data && data.leads.length === 0 ? <EmptyState title={data.counts.all ? 'No leads match' : 'No leads yet'} body={data.counts.all ? 'Try a different filter or search.' : 'Use Import Leads to upload a CSV or pull in your saved prospects.'} />
          : data && (
            <div style={{ overflowX: 'auto', padding: '10px 18px 6px' }}>
              <table className="acq-table" style={{ minWidth: 760 }}>
                <thead><tr><th>Business</th><th>Email</th><th>Campaign</th><th>Status</th><th>Opens</th><th>Last activity</th></tr></thead>
                <tbody>
                  {data.leads.map((l) => (
                    <tr key={l.id}>
                      <td style={{ maxWidth: 220 }}><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><BizLogo name={l.business || l.name || l.email} website={l.website} /><span style={{ fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.business || l.name || l.email.split('@')[1]}</span></span></td>
                      <td className="acq-muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email}</td>
                      <td><Link href={`/client-acquisition/campaigns/${l.campaignId}`} className="acq-muted" style={{ textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}>{l.campaignName}</Link></td>
                      <td><Pill label={LABEL[l.stage] ?? l.stage} tone={l.stage === 'clicked' ? 'acq-pill-blue' : undefined} /></td>
                      <td>{l.opens || '—'}</td>
                      <td className="acq-muted" style={{ whiteSpace: 'nowrap' }}>{timeAgoShort(l.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        {data && data.total > data.pageSize && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid #eef2f8' }}>
            <span className="acq-sub" style={{ fontSize: 13 }}>Page {page} of {pages} · {data.total} leads</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button className="acq-btn acq-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="acq-btn acq-btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function LeadsPage() { return <Suspense fallback={null}><LeadsInner /></Suspense>; }

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, MessageCircle, X } from 'lucide-react';
import { timeAgo } from '@/lib/acqOverview';
import { useAcq } from '@/components/acq/AcqProvider';
import Conversations from '@/components/acq/Conversations';
import { BizLogo, Card, EmptyState, Pill, Skeleton } from '@/components/acq/ui';

interface Item {
  id: string; campaignId: string; campaignName: string; email: string; name: string | null; business: string | null; website: string | null;
  repliedAt: string | null; sentAt: string | null; outcome: string | null; opens: number;
}
type Tab = 'new' | 'interested' | 'not_interested' | 'followups';

export default function InboxPage() {
  const { reload } = useAcq();
  const [data, setData] = useState<{ replies: Item[]; followUps: Item[] } | null>(null);
  const [tab, setTab] = useState<Tab>('new');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/client-acquisition/inbox');
      const json = await res.json() as { replies: Item[]; followUps: Item[]; error?: string };
      if (!res.ok) { setError(json.error ?? 'Could not load your inbox.'); return; }
      setData(json); setError('');
    } catch { setError('Could not load your inbox.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const decide = async (i: Item, outcome: 'interested' | 'not_interested') => {
    await fetch(`/api/outreach-campaigns/${i.campaignId}/leads/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome }) });
    await Promise.all([load(), reload()]);
  };

  const lists = useMemo(() => ({
    new: data?.replies.filter((r) => !r.outcome) ?? [],
    interested: data?.replies.filter((r) => r.outcome === 'interested') ?? [],
    not_interested: data?.replies.filter((r) => r.outcome === 'not_interested') ?? [],
    followups: data?.followUps ?? [],
  }), [data]);
  const TABS: Array<{ id: Tab; label: string }> = [{ id: 'new', label: 'New replies' }, { id: 'interested', label: 'Interested' }, { id: 'not_interested', label: 'Not interested' }, { id: 'followups', label: 'Needs follow-up' }];
  const items = lists[tab];

  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">Inbox &amp; Opportunities</h1>
        <p className="acq-sub" style={{ marginTop: 2 }}>Replies arrive in your own mailbox. Check your inbox to bring them in: RUNVAX reads each one, stops that contact&apos;s follow-ups and suggests an answer.</p>
      </div>
      <Conversations />
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          {TABS.map((t) => <button key={t.id} className={`acq-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label} <span style={{ opacity: .7 }}>{lists[t.id].length}</span></button>)}
        </div>
        {error && <p className="acq-warn">{error}</p>}
        {!data && !error ? <div style={{ display: 'grid', gap: 14, paddingTop: 10 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={40} />)}</div>
          : items.length === 0 ? (
            <EmptyState
              title={tab === 'new' ? 'No replies waiting' : tab === 'followups' ? 'Nobody needs a follow-up' : 'Nothing here yet'}
              body={tab === 'new' ? 'Replies you mark by hand in a campaign show up here.' : undefined}
            />
          ) : (
            <div>
              {items.map((i) => (
                <div key={i.id} className="acq-row" style={{ alignItems: 'center' }}>
                  <BizLogo name={i.business || i.name || i.email} website={i.website} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.business || i.name || i.email}</p>
                    <p className="acq-sub" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i.email} · <Link href={`/client-acquisition/campaigns/${i.campaignId}`} style={{ textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}>{i.campaignName}</Link>
                    </p>
                  </div>
                  <span className="acq-sub" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{tab === 'followups' ? `Sent ${timeAgo(i.sentAt)}` : `Replied ${timeAgo(i.repliedAt)}`}</span>
                  {tab === 'followups' ? <Pill label="Needs follow-up" /> : i.outcome ? <Pill label={i.outcome === 'interested' ? 'Interested' : 'Not interested'} /> : null}
                  {tab === 'followups' ? (
                    <Link href={`/client-acquisition/campaigns/${i.campaignId}`} className="acq-btn acq-btn-sm">Open campaign</Link>
                  ) : (
                    <span style={{ display: 'flex', gap: 6 }}>
                      {i.outcome !== 'interested' && <button className="acq-btn acq-btn-sm" style={{ color: '#15803d' }} onClick={() => void decide(i, 'interested')}><Check size={14} /> Interested</button>}
                      {i.outcome !== 'not_interested' && <button className="acq-btn acq-btn-sm" style={{ color: '#64748b' }} onClick={() => void decide(i, 'not_interested')}><X size={14} /> Not interested</button>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
      </Card>
      <p className="acq-faint" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><MessageCircle size={13} /> Replies are read when you press Check my inbox. The list below is for replies you marked by hand in a campaign.</p>
    </div>
  );
}


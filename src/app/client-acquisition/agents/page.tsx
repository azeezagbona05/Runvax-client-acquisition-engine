'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MessageCircle, Newspaper, Plus } from 'lucide-react';
import { Card, EmptyState, Pill, Skeleton } from '@/components/acq/ui';

interface MyAgent { id: string; kind: 'visibility' | 'assistant'; label?: string; name: string; status: string; counts: { posts?: number; drafts?: number; chats?: number; leads?: number }; config: { business: { name: string } } }

function MyAgents() {
  const [list, setList] = useState<MyAgent[] | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => { fetch('/api/client-acquisition/agents').then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => setList(j.agents)).catch(() => setFailed(true)); }, []);
  return (
    <Card title="Your agents" right={<Link href="/client-acquisition/agents/new" className="acq-btn acq-btn-primary"><Plus size={15} /> Build an agent</Link>}>
      {failed ? <EmptyState title="Couldn't load your agents" />
        : !list ? <div style={{ display: 'grid', gap: 12 }}>{[0, 1].map((i) => <Skeleton key={i} h={22} />)}</div>
        : list.length === 0 ? <EmptyState title="Build your first agent" body="Receptionist, sales, support, appointments, shopping, staff help, or a Visibility Agent that writes articles for your website. Describe the job in plain English and RUNVAX builds it, with the skills it needs." />
        : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((a) => { const I = a.kind === 'visibility' ? Newspaper : MessageCircle; return (
              <Link key={a.id} href={`/client-acquisition/agents/${a.id}`} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, display: 'grid', gap: 6, color: 'inherit', textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="acq-stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}><I size={18} /></span><b style={{ flex: 1, minWidth: 0 }}>{a.name}</b><Pill label={{ active: 'Running', paused: 'Paused', draft: 'Not started' }[a.status] ?? a.status} /></div>
                {a.label && <p className="acq-faint" style={{ fontSize: 12 }}>{a.label}</p>}
                <p className="acq-sub" style={{ fontSize: 13 }}>{a.kind === 'visibility' ? `${a.counts.posts ?? 0} ${a.counts.posts === 1 ? 'article' : 'articles'} live · ${a.counts.drafts ?? 0} waiting for you` : `${a.counts.chats ?? 0} ${a.counts.chats === 1 ? 'conversation' : 'conversations'} · ${a.counts.leads ?? 0} ${a.counts.leads === 1 ? 'lead' : 'leads'}`}</p>
              </Link>); })}
          </div>
        )}
    </Card>
  );
}

export default function AgentsPage() {
  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">AI Agents</h1>
        <p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>Build your own AI agents for your website, Telegram and more: a receptionist, a sales or support agent, an appointment or shopping assistant, or a Visibility Agent that writes articles for your website.</p>
      </div>
      <MyAgents />
    </div>
  );
}

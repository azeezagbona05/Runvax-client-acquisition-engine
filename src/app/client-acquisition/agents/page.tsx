'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MessageCircle, Newspaper, Plus } from 'lucide-react';
import { AGENT_ICON_FALLBACK, AGENT_LOOK, useWorkforce } from '@/components/acq/AgentsPanel';
import { Card, EmptyState, Pill, Skeleton } from '@/components/acq/ui';
import { timeAgo } from '@/lib/acqOverview';
import { WORKFORCE } from '@/lib/workforce';

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
  const { data, failed } = useWorkforce();
  const now = Date.now();
  const names = Object.fromEntries(WORKFORCE.map((a) => [a.id, a.name]));

  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">AI Agents</h1>
        <p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>Build your own agents for your website, Telegram and more, and see the six built-in agents that run your campaigns. They plan, write, send and read replies; follow-ups wait for your click and nothing replies to a prospect without your approval.</p>
      </div>
      <MyAgents />
      <h2 className="acq-title" style={{ marginTop: 8 }}>Your campaign workforce</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data?.agents ?? WORKFORCE.map((w) => ({ ...w, latest: null, week: 0, active: false }))).map((a) => {
          const look = AGENT_LOOK[a.id]; const Icon = look?.icon ?? AGENT_ICON_FALLBACK;
          return (
            <Card key={a.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="acq-stat-icon" style={{ background: look?.tint, color: look?.ink }}><Icon size={22} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{a.name}</p>
                  <p className="acq-sub" style={{ fontSize: 13 }}>{a.role}</p>
                </div>
                {data && <Pill label={a.active ? 'Active' : 'Idle'} />}
              </div>
              <p className="acq-sub" style={{ marginTop: 12, fontSize: 13.5 }}>{a.does}</p>
              <p className="acq-faint" style={{ marginTop: 10, fontSize: 12.5 }}>{a.latest ? `Last: ${a.latest.action} (${timeAgo(a.latest.at, now)})` : a.idle}</p>
              <p style={{ marginTop: 8, fontSize: 13 }}><b style={{ fontSize: 20 }}>{a.week}</b> <span className="acq-sub">actions this week</span></p>
            </Card>
          );
        })}
      </div>
      <Card title="Shared campaign log">
        {failed ? <EmptyState title="Couldn't load agent activity" />
          : !data ? <div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={22} />)}</div>
          : data.log.length === 0 ? <EmptyState title="No activity yet" body="Build a campaign and the agents start working. Everything they do is listed here." />
          : (
            <table className="acq-table acq-rt"><tbody>
              {data.log.map((a) => (
                <tr key={a.id}>
                  <td data-primary style={{ width: 200, fontWeight: 600, color: '#0f172a' }}>{names[a.agent] ?? a.agent}</td>
                  <td data-wide>{a.action}{a.detail ? <span className="acq-sub" style={{ display: 'block', fontSize: 12.5 }}>{a.detail}</span> : null}</td>
                  <td className="acq-muted" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{timeAgo(a.at, now)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
      </Card>
    </div>
  );
}

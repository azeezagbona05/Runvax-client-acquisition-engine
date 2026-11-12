'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bot, Code2, MessageCircle, Plus, UserPlus, FileText, Users } from 'lucide-react';
import { Card, EmptyState, Pill, Skeleton, fmtNum } from '../ui';
import { CATEGORIES, TEMPLATES, type Category, type TemplateId } from '@/lib/agents/templates';
import type { AssistantConfig, VisibilityConfig } from '@/lib/agents/kinds';
import type { presentAgent } from '@/lib/agents/present';
import { ICON } from '../agents/AgentBuilder';
import { Manager, type Source } from '../agents/KnowledgePanel';
import { timeAgo } from '@/lib/acqOverview';

type Agent = ReturnType<typeof presentAgent>;
const STATUS: Record<string, string> = { active: 'Running', paused: 'Paused', draft: 'Not started' };
const BASE = '/client-acquisition';

function Head({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div style={{ paddingTop: 4, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div><h1 className="acq-page-title">{title}</h1><p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>{body}</p></div>
      {action}
    </div>
  );
}
const BuildButton = () => <Link href={`${BASE}/agents/new`} className="acq-btn acq-btn-primary"><Plus size={15} /> Build an agent</Link>;

function useAgents() {
  const [list, setList] = useState<Agent[] | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => { fetch('/api/client-acquisition/agents', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => setList(j.agents)).catch(() => setFailed(true)); }, []);
  return { list, failed };
}

/* ---------- Overview ---------- */
interface Summary { conversations: number; changePct: number | null; leads: number; activeAgents: number; agents: number; events: Array<{ id: string; kind: 'lead' | 'agent' | 'article'; title: string; detail: string; at: string }> }

export function StudioOverview() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => { fetch('/api/client-acquisition/agents/summary?days=30', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setS).catch(() => setS({ conversations: 0, changePct: null, leads: 0, activeAgents: 0, agents: 0, events: [] })); }, []);
  const kpis = [
    { label: 'Agents running', value: s?.activeAgents, sub: s ? `${s.agents} built in total` : '', icon: Bot },
    { label: 'Conversations (30 days)', value: s?.conversations, sub: s?.changePct == null ? '' : `${s.changePct < 0 ? '↓' : '↑'} ${Math.abs(s.changePct)}% vs the 30 days before`, icon: MessageCircle },
    { label: 'Leads captured (30 days)', value: s?.leads, sub: '', icon: Users },
  ];
  const actions = [
    { href: `${BASE}/agents/new`, title: 'Build an agent', body: 'Describe the job in plain English', icon: Plus },
    { href: `${BASE}/studio/templates`, title: 'Start from a template', body: 'Receptionist, sales, support and more', icon: FileText },
    { href: `${BASE}/studio/deployments`, title: 'Deploy an agent', body: 'Website, WordPress, Telegram', icon: Code2 },
    { href: `${BASE}/studio/conversations`, title: 'Read conversations', body: 'See what visitors asked', icon: MessageCircle },
  ];
  return (
    <div className="acq-stack">
      <Head title="AI Agent Studio" body="Build AI agents, put them on your website and channels, and see what they are doing for your business." action={<BuildButton />} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {kpis.map((k) => { const I = k.icon; return (
          <section key={k.label} className="acq-card acq-card-pad" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span className="acq-stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}><I size={20} /></span>
            <div><p className="acq-sub" style={{ fontSize: 13 }}>{k.label}</p>{k.value == null ? <Skeleton h={26} w={60} /> : <b style={{ fontSize: 26 }}>{fmtNum(k.value)}</b>}{k.sub && <p className="acq-faint" style={{ fontSize: 12 }}>{k.sub}</p>}</div>
          </section>); })}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((a) => { const I = a.icon; return (
          <Link key={a.href} href={a.href} className="acq-card acq-card-pad" style={{ display: 'grid', gap: 4, color: 'inherit', textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><I size={18} style={{ color: '#7e22ce' }} /><b>{a.title}</b><ArrowRight size={15} style={{ marginLeft: 'auto', color: '#94a3b8' }} /></span>
            <span className="acq-sub" style={{ fontSize: 13 }}>{a.body}</span>
          </Link>); })}
      </div>
      <Card title="Recent agent activity">
        {!s ? <div style={{ display: 'grid', gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={20} />)}</div>
          : s.events.length === 0 ? <EmptyState title="Nothing yet" body="Build your first agent and its activity shows up here." action={<BuildButton />} />
          : <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>{s.events.map((e) => { const I = e.kind === 'lead' ? UserPlus : e.kind === 'article' ? FileText : Bot; return (
              <li key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}><I size={17} style={{ color: '#7e22ce', flex: 'none' }} /><span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{e.title}</b> <span className="acq-sub" style={{ fontSize: 13 }}>{e.detail}</span></span><span className="acq-faint" style={{ fontSize: 12 }}>{timeAgo(e.at)}</span></li>); })}</ul>}
      </Card>
    </div>
  );
}

/* ---------- Agent Templates ---------- */
export function StudioTemplates() {
  const groups = useMemo(() => (Object.keys(CATEGORIES) as Category[]).map((c) => ({ c, ids: (Object.keys(TEMPLATES) as TemplateId[]).filter((t) => TEMPLATES[t].category === c) })).filter((g) => g.ids.length), []);
  return (
    <div className="acq-stack">
      <Head title="Agent Templates" body="A template is a ready-made starting point: the role, goals, skills and hand-off rules are filled in. Pick one, then review it and make it yours." action={<BuildButton />} />
      {groups.map((g) => (
        <section key={g.c} style={{ display: 'grid', gap: 10 }}>
          <h2 className="acq-title">{CATEGORIES[g.c]}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {g.ids.map((id) => {
              const t = TEMPLATES[id]; const I = ICON[id]; const soon = t.status === 'soon';
              const href = t.status === 'campaign' ? `${BASE}/automation` : `${BASE}/agents/new?template=${id}`;
              const inner = (<>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="acq-stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}><I size={18} /></span><b>{t.label}</b>
                  {t.status === 'campaign' && <Pill label="Uses a campaign" tone="acq-pill-purple" />}{soon && <Pill label="Coming soon" tone="acq-pill-gray" />}
                </span>
                <span style={{ fontWeight: 600, color: '#334155', fontSize: 13.5 }}>{t.tagline}</span>
                {!soon && <span className="acq-link" style={{ fontSize: 13 }}>{t.status === 'campaign' ? 'Open the campaign builder' : 'Use this template'} →</span>}
              </>);
              const box = { display: 'grid', gap: 6, border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: soon ? '#f8fafc' : '#fff', color: 'inherit', textDecoration: 'none', opacity: soon ? 0.7 : 1 } as const;
              return soon ? <div key={id} style={box} aria-disabled="true">{inner}</div> : <Link key={id} href={href} style={box}>{inner}</Link>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------- Knowledge Base ---------- */
export function StudioKnowledge() {
  const [sources, setSources] = useState<Source[] | null>(null); const [open, setOpen] = useState(false);
  const load = useCallback(() => { fetch('/api/client-acquisition/knowledge', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => setSources(j.sources)).catch(() => setSources([])); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="acq-stack">
      <Head title="Knowledge Base" body="What your agents answer from: your website, PDFs, price tables and FAQs. Add it once here, then switch it on for any agent in that agent's settings." action={<button type="button" className="acq-btn acq-btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Add or manage knowledge</button>} />
      <Card title={sources ? `Your sources (${sources.length})` : 'Your sources'}>
        {!sources ? <div style={{ display: 'grid', gap: 10 }}>{[0, 1].map((i) => <Skeleton key={i} h={22} />)}</div>
          : sources.length === 0 ? <EmptyState title="Nothing added yet" body="Add your website address or upload a PDF, a price list or your FAQs, and agents can answer from them." action={<button type="button" className="acq-btn acq-btn-primary" onClick={() => setOpen(true)}>Add knowledge</button>} />
          : <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>{sources.map((s) => (
              <li key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                <b style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{s.name}</b>
                <span className="acq-faint" style={{ fontSize: 12 }}>{({ website: 'Website', pdf: 'Document', table: 'Table', qa: 'Q&A', text: 'Notes' } as const)[s.kind]}</span>
                <Pill label={s.status === 'failed' ? 'Failed' : 'Active'} />
              </li>))}</ul>}
      </Card>
      {open && sources && <Manager sources={sources} ids={[]} onChange={() => undefined} reload={load} close={() => setOpen(false)} standalone />}
    </div>
  );
}

/* ---------- Deployments ---------- */
function channelsOf(a: Agent): Array<{ label: string; on: boolean }> {
  if (a.kind === 'visibility') {
    const d = (a.config as VisibilityConfig).destinations;
    return [{ label: 'Website embed', on: d.embed }, { label: 'Hosted page', on: d.hosted }, { label: 'RSS feed', on: d.rss }, { label: 'WordPress', on: !!d.wordpress }, { label: 'Webhook', on: !!d.webhookUrl }];
  }
  const c = a.config as AssistantConfig;
  return [{ label: 'Website chat', on: c.channels.web }, { label: 'Telegram', on: c.channels.telegram && a.secrets.telegramToken }, { label: 'CRM webhook', on: !!c.crmWebhookUrl }];
}

export function StudioDeployments() {
  const { list, failed } = useAgents();
  return (
    <div className="acq-stack">
      <Head title="Deployments" body="Where each of your agents is live: your website, WordPress, Telegram and more. Open one to get its install code." action={<BuildButton />} />
      {failed ? <EmptyState title="Couldn't load your agents" />
        : !list ? <Skeleton h={90} />
        : list.length === 0 ? <Card><EmptyState title="No agents to deploy yet" body="Build an agent first. Then come back here for its website code, WordPress and Telegram setup." action={<BuildButton />} /></Card>
        : (
          <div style={{ display: 'grid', gap: 12 }}>
            {list.map((a) => (
              <section key={a.id} className="acq-card acq-card-pad" style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 15 }}>{a.name}</b><Pill label={STATUS[a.status] ?? a.status} />
                  <span className="acq-faint" style={{ fontSize: 12 }}>{a.label}</span>
                  <Link href={`${BASE}/agents/${a.id}?tab=deploy`} className="acq-btn acq-btn-sm" style={{ marginLeft: 'auto' }}><Code2 size={14} /> Get code &amp; set up</Link>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {channelsOf(a).map((c) => <span key={c.label} style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: c.on ? '#dcfce7' : '#f1f5f9', color: c.on ? '#166534' : '#64748b' }}>{c.on ? '● ' : '○ '}{c.label}</span>)}
                </div>
                {a.status !== 'active' && <p className="acq-sub" style={{ fontSize: 13 }}>This agent is not running, so nothing is live yet. Switch it on from its page.</p>}
              </section>
            ))}
          </div>
        )}
    </div>
  );
}

/* ---------- Conversations ---------- */
interface Chat { id: string; agentId: string; agentName: string; channel: string; visitor: { name?: string; email?: string; phone?: string; company?: string; need?: string } | null; status: string; messages: Array<{ r: 'v' | 'a'; t: string }>; updatedAt: string }
const FILTERS: Array<[string, string]> = [['', 'All'], ['lead', 'Leads'], ['handoff', 'Needs a person']];

export function StudioConversations() {
  const [filter, setFilter] = useState(''); const [chats, setChats] = useState<Chat[] | null>(null); const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { let live = true; setChats(null); fetch(`/api/client-acquisition/agents/conversations${filter ? `?status=${filter}` : ''}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => { if (live) setChats(j.chats); }).catch(() => { if (live) setChats([]); }); return () => { live = false; }; }, [filter]);
  return (
    <div className="acq-stack">
      <Head title="Conversations" body="Every chat your agents have had, across all of them. Leads and people who asked for a human are marked." />
      <div className="acq-seg" role="tablist" aria-label="Filter conversations" style={{ justifySelf: 'start' }}>{FILTERS.map(([v, l]) => <button key={v} role="tab" aria-selected={filter === v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>{l}</button>)}</div>
      {!chats ? <Skeleton h={90} />
        : chats.length === 0 ? <Card><EmptyState title="No conversations yet" body="Once an agent is switched on and deployed, visitors who chat with it appear here." action={<Link href={`${BASE}/studio/deployments`} className="acq-btn">Go to Deployments</Link>} /></Card>
        : (
          <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 12 }}>
            {chats.map((c) => (
              <article key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <b>{c.visitor?.name || c.visitor?.email || c.visitor?.phone || 'Anonymous visitor'}{c.visitor?.company ? ` · ${c.visitor.company}` : ''}</b>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Pill label={c.status === 'handoff' ? 'Needs a person' : c.status === 'lead' ? 'Interested' : 'Idle'} tone={c.status === 'handoff' ? 'acq-pill-amber' : undefined} /><span className="acq-faint" style={{ fontSize: 12 }}>{c.agentName} · {c.channel === 'telegram' ? 'Telegram' : 'Website'} · {timeAgo(c.updatedAt)}</span></span>
                </div>
                {(c.visitor?.email || c.visitor?.phone) && <p style={{ fontSize: 13.5 }}>{[c.visitor.email, c.visitor.phone].filter(Boolean).join(' · ')}</p>}
                {c.visitor?.need && <p className="acq-sub" style={{ fontSize: 13.5 }}>Looking for: {c.visitor.need}</p>}
                <button className="acq-link" style={{ justifySelf: 'start' }} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide' : 'Read'} the conversation</button>
                {open === c.id && <div style={{ display: 'grid', gap: 4, fontSize: 13.5 }}>{c.messages.map((m, i) => <p key={i}><b>{m.r === 'v' ? 'Visitor' : 'Assistant'}:</b> {m.t}</p>)}</div>}
              </article>
            ))}
          </section>
        )}
    </div>
  );
}

/* ---------- Analytics ---------- */
interface Analytics { days: number; conversations: number; leads: number; handoffs: number; channels: { website: number; telegram: number }; series: Array<{ date: string; count: number }>; agents: Array<{ id: string; name: string; kind: string; status: string; conversations: number; leads: number; articles: number }> }

export function StudioAnalytics() {
  const [days, setDays] = useState(30); const [d, setD] = useState<Analytics | null>(null);
  useEffect(() => { let live = true; setD(null); fetch(`/api/client-acquisition/agents/analytics?days=${days}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => { if (live) setD(j); }).catch(() => { if (live) setD({ days, conversations: 0, leads: 0, handoffs: 0, channels: { website: 0, telegram: 0 }, series: [], agents: [] }); }); return () => { live = false; }; }, [days]);
  const max = Math.max(1, ...(d?.series.map((p) => p.count) ?? [1]));
  const rate = d && d.conversations ? Math.round((d.leads / d.conversations) * 100) : 0;
  const tiles = d ? [['Conversations', fmtNum(d.conversations)], ['Leads captured', fmtNum(d.leads)], ['Lead rate', `${rate}%`], ['Needed a person', fmtNum(d.handoffs)]] : [];
  return (
    <div className="acq-stack">
      <Head title="Analytics" body="How your agents are performing: conversations, leads and which agent does the most." action={
        <div className="acq-seg" role="tablist" aria-label="Date range">{[7, 30, 90].map((n) => <button key={n} role="tab" aria-selected={days === n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>{n} days</button>)}</div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {!d ? [0, 1, 2, 3].map((i) => <Skeleton key={i} h={72} r={14} />) : tiles.map(([l, v]) => <section key={l} className="acq-card acq-card-pad"><p className="acq-sub" style={{ fontSize: 13 }}>{l}</p><b style={{ fontSize: 26 }}>{v}</b></section>)}
      </div>
      <Card title="Conversations per day">
        {!d ? <Skeleton h={140} /> : d.conversations === 0 ? <EmptyState title="No conversations in this period" body="Deploy an agent and its chats are charted here." />
          : (
            <div role="img" aria-label={`Conversations per day over the last ${d.days} days, ${d.conversations} in total`} style={{ display: 'flex', alignItems: 'flex-end', gap: d.days > 30 ? 1 : 3, height: 140 }}>
              {d.series.map((p) => <div key={p.date} title={`${p.date}: ${p.count}`} style={{ flex: 1, minWidth: 1, height: `${Math.max(p.count ? 4 : 1, (p.count / max) * 100)}%`, background: p.count ? '#9333ea' : '#e2e8f0', borderRadius: '3px 3px 0 0' }} />)}
            </div>
          )}
        {d && d.conversations > 0 && <p className="acq-faint" style={{ fontSize: 12, marginTop: 8 }}>Website {fmtNum(d.channels.website)} · Telegram {fmtNum(d.channels.telegram)}</p>}
      </Card>
      <Card title="By agent" pad={false}>
        {!d ? <div style={{ padding: 18 }}><Skeleton h={60} /></div> : d.agents.length === 0 ? <div style={{ padding: 18 }}><EmptyState title="No agents yet" action={<BuildButton />} /></div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12 }}><th style={{ padding: '10px 18px' }}>Agent</th><th>Status</th><th>Conversations</th><th>Leads</th><th>Articles</th></tr></thead>
                <tbody>{d.agents.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 18px' }}><Link className="acq-link" href={`${BASE}/agents/${a.id}`}>{a.name}</Link></td>
                    <td><Pill label={STATUS[a.status] ?? a.status} /></td>
                    <td>{a.kind === 'visibility' ? '–' : fmtNum(a.conversations)}</td><td>{a.kind === 'visibility' ? '–' : fmtNum(a.leads)}</td><td>{a.kind === 'visibility' ? fmtNum(a.articles) : '–'}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}

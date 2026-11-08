'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowRight, Bot, Code2, FileText, MessageCircle, Send, Target, UserPlus, Users } from 'lucide-react';
import { useAcq } from '@/components/acq/AcqProvider';
import CountUp from '@/components/acq/CountUp';
import { ACTIVITY_ICON } from '@/components/acq/RecentActivity';
import { EmptyState, Skeleton, fmtNum } from '@/components/acq/ui';
import { timeAgo } from '@/lib/acqOverview';
import { DEFAULT_HOME } from '@/lib/home';

interface AgentSummary { conversations: number; changePct: number | null; leads: number; activeAgents: number; agents: number; events: Array<{ id: string; kind: 'lead' | 'agent' | 'article'; title: string; detail: string; at: string }> }
const RANGES = [{ d: 7, label: 'Last 7 days' }, { d: 30, label: 'Last 30 days' }, { d: 90, label: 'Last 90 days' }];

function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return null;
  return <span className={`acq-delta${pct < 0 ? ' down' : ''}`}>{pct < 0 ? '↓' : '↑'} {Math.abs(pct)}%</span>;
}

const MODULES = [
  { href: DEFAULT_HOME, title: 'Prospecting & Campaigns', body: 'Find business leads, create AI campaigns, automate follow-ups and generate opportunities.', icon: Target, bg: '#faf5ff' },
  { href: '/client-acquisition/agents', title: 'AI Agent Studio', body: 'Build, customise and deploy AI receptionists, visibility agents and more for your business.', icon: Bot, bg: '#f5f3ff' },
];
const ACTIONS = [
  { href: DEFAULT_HOME, title: 'Find Leads', body: 'Generate business prospects', icon: Target },
  { href: '/client-acquisition/automation', title: 'Create Campaign', body: 'Build a full campaign with AI', icon: Send },
  { href: '/client-acquisition/agents/new', title: 'Build an AI Agent', body: 'Create a receptionist or other agent', icon: Bot },
  { href: '/client-acquisition/agents', title: 'Deploy on Website', body: 'Get the script and go live', icon: Code2 },
];

/** The home hub: pick a module, see how things are going, jump to the common tasks. */
export default function ClientAcquisitionHome() {
  const { data, days, setDays } = useAcq();
  const { data: session } = useSession();
  const [agents, setAgents] = useState<AgentSummary | null>(null);
  const first = session?.user?.name?.trim().split(/\s+/)[0];
  const range = RANGES.some((r) => r.d === days) ? days : 7;
  useEffect(() => { if (!RANGES.some((r) => r.d === days)) setDays(7); }, [days, setDays]);
  useEffect(() => { let live = true; setAgents(null); fetch(`/api/client-acquisition/agents/summary?days=${range}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => { if (live) setAgents(j); }).catch(() => { if (live) setAgents({ conversations: 0, changePct: null, leads: 0, activeAgents: 0, agents: 0, events: [] }); }); return () => { live = false; }; }, [range]);

  const c = data?.cards;
  const kpis: Array<{ label: string; value: number | null; delta: number | null | undefined; icon: typeof Users }> = [
    { label: 'Leads Generated', value: c ? c.totalLeads : null, delta: c?.leadsGrowthPct, icon: Users },
    { label: 'Campaigns Active', value: data ? data.runningCampaigns : null, delta: undefined, icon: Send },
    { label: 'Conversations (Agents)', value: agents ? agents.conversations : null, delta: agents?.changePct, icon: MessageCircle },
    { label: 'Opportunities', value: c ? c.interested : null, delta: undefined, icon: Target },
  ];
  // A soft spotlight that follows the pointer over a module card.
  const spot = (e: React.MouseEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`); };

  type Row = { id: string; title: string; detail: string; at: string; icon: typeof Send; color: string };
  const rows: Row[] = [
    ...(data?.activity ?? []).slice(0, 6).map((e) => ({ id: e.id, title: e.text, detail: e.campaignName, at: e.at, icon: ACTIVITY_ICON[e.type].icon, color: ACTIVITY_ICON[e.type].color })),
    ...(agents?.events ?? []).map((e) => ({ id: e.id, title: e.title, detail: e.detail, at: e.at, icon: e.kind === 'lead' ? UserPlus : e.kind === 'article' ? FileText : Bot, color: e.kind === 'lead' ? '#16a34a' : '#9333ea' })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  const loadingRows = !data || !agents;

  return (
    <div className="acq-stack">
      <div className="acq-home-rise" style={{ paddingTop: 4, ['--i' as string]: 0 }}>
        <h1 className="acq-page-title">Welcome back{first ? `, ${first}` : ''} <span className="acq-wave" aria-hidden="true">👋</span></h1>
        <p className="acq-sub" style={{ marginTop: 2 }}>Choose a module to continue or view your overall performance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {MODULES.map((m, i) => (
          <section key={m.title} className="acq-home-module acq-home-rise" style={{ background: m.bg, ['--i' as string]: 1 + i }} aria-label={m.title} onMouseMove={spot}>
            <m.icon className="acq-home-module-art" size={132} strokeWidth={1.2} aria-hidden="true" />
            <span className="acq-home-module-icon"><m.icon size={28} /></span>
            <h2>{m.title}</h2>
            <p>{m.body}</p>
            <Link href={m.href} className="acq-btn acq-btn-primary" style={{ justifySelf: 'start' }}>Open Module <ArrowRight size={15} /></Link>
          </section>
        ))}
      </div>

      <section className="acq-card acq-card-pad acq-home-rise" style={{ ['--i' as string]: 3 }} aria-label="Performance overview">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <h2 className="acq-title">Performance Overview <Link href="/client-acquisition/overview" className="acq-link" style={{ marginLeft: 10, fontWeight: 500 }}>Full report <ArrowRight size={13} /></Link></h2>
          <div className="acq-seg" role="group" aria-label="Date range">
            {RANGES.map((r) => <button key={r.d} type="button" className={range === r.d ? 'on' : ''} aria-pressed={range === r.d} onClick={() => setDays(r.d)}>{r.label}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="acq-home-kpi">
              <span className="acq-stat-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}><k.icon size={22} /></span>
              <div style={{ minWidth: 0 }}>
                <p className="acq-stat-label">{k.label}{k.value !== null && k.value > 0 && (k.label === 'Campaigns Active' || k.label.startsWith('Conversations')) && <span className="acq-live" title="Live" aria-hidden="true" />}</p>
                {k.value === null ? <Skeleton h={28} w={70} /> : <p style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}><span className="acq-stat-value"><CountUp key={range} value={k.value} initial={0} ms={900} /></span><span className="acq-home-pop"><Delta pct={k.delta} /></span></p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="acq-card acq-card-pad acq-home-rise lg:col-span-3" style={{ ['--i' as string]: 4 }} aria-label="Recent activity">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <h2 className="acq-title">Recent Activity</h2>
            <Link href="/client-acquisition/activity" className="acq-link">View all <ArrowRight size={13} /></Link>
          </div>
          {loadingRows ? <div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={44} />)}</div>
            : rows.length === 0 ? <EmptyState title="Nothing yet" body="Find leads, start a campaign or build an agent and what happens shows up here." />
            : <div className="acq-home-rows">{rows.map((r) => (
                <div key={r.id} className="acq-home-row">
                  <span className="acq-home-row-icon" style={{ color: r.color }}><r.icon size={18} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}><p className="acq-home-row-title">{r.title}</p><p className="acq-home-row-sub">{r.detail}</p></div>
                  <span className="acq-muted" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{timeAgo(r.at)}</span>
                </div>))}</div>}
        </section>

        <section className="acq-card acq-card-pad acq-home-rise lg:col-span-2" style={{ ['--i' as string]: 5 }} aria-label="Quick actions">
          <h2 className="acq-title" style={{ marginBottom: 10 }}>Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {ACTIONS.map((a) => (
              <Link key={a.title} href={a.href} className="acq-home-action">
                <span className="acq-home-row-icon" style={{ color: '#9333ea' }}><a.icon size={20} /></span>
                <span style={{ minWidth: 0 }}><b>{a.title}</b><span>{a.body}</span></span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Send } from 'lucide-react';
import AgentsPanel, { AGENT_ICON_FALLBACK, AGENT_LOOK, useWorkforce } from '@/components/acq/AgentsPanel';
import { Card, EmptyState } from '@/components/acq/ui';
import { WORKFORCE } from '@/lib/workforce';
import { timeAgo } from '@/lib/acqOverview';

/** The AI team behind campaigns: six agents that plan, write, send, follow up and read replies. They belong to Prospecting, not the Agent Studio. */
export default function CampaignAgentsPage() {
  const { data } = useWorkforce();
  const name = (id: string) => WORKFORCE.find((w) => w.id === id)?.name ?? id;
  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h1 className="acq-page-title">Campaign AI Agents</h1>
          <p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>Your AI workforce for campaigns. They plan the sequence, understand your audience, write the emails, send, follow up and read replies, all inside your campaigns.</p>
        </div>
        <Link href="/client-acquisition/automation" className="acq-btn acq-btn-primary"><Send size={15} /> Create a campaign</Link>
      </div>
      <AgentsPanel />
      <Card title="What each agent does">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {WORKFORCE.map((a) => { const look = AGENT_LOOK[a.id]; const I = look?.icon ?? AGENT_ICON_FALLBACK; return (
            <div key={a.id} style={{ display: 'flex', gap: 12, border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
              <span className="acq-stat-icon" style={{ background: look?.tint, color: look?.ink, flex: 'none' }}><I size={20} /></span>
              <div><b style={{ fontSize: 14.5 }}>{a.name}</b><p className="acq-sub" style={{ fontSize: 13, marginTop: 2 }}>{a.does}</p></div>
            </div>); })}
        </div>
      </Card>
      <Card title="Recent agent activity">
        {!data ? <p className="acq-sub">Loading…</p> : data.log.length === 0 ? <EmptyState title="No activity yet" body="Run a campaign and every step the agents take is logged here." />
          : <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>{data.log.slice(0, 20).map((l) => (
              <li key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13.5 }}>{name(l.agent)}</b><span style={{ fontSize: 13.5, flex: 1, minWidth: 0 }}>{l.action}{l.detail ? <span className="acq-sub"> · {l.detail}</span> : null}</span>
                {l.campaignId && <Link className="acq-link" style={{ fontSize: 12 }} href={`/client-acquisition/campaigns/${l.campaignId}`}>Campaign</Link>}
                <span className="acq-faint" style={{ fontSize: 12 }}>{timeAgo(l.at)}</span>
              </li>))}</ul>}
      </Card>
    </div>
  );
}

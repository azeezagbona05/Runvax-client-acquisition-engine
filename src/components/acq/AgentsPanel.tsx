'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, ClipboardList, MessageSquare, PenLine, Repeat, Send, Users, type LucideIcon } from 'lucide-react';
import { Card, EmptyState, Pill, Skeleton } from './ui';
import { timeAgo } from '@/lib/acqOverview';
import { WORKFORCE } from '@/lib/workforce';

export interface WorkforceAgent { id: string; name: string; role: string; does: string; idle: string; latest: { action: string; detail: string | null; at: string } | null; week: number; active: boolean }
export interface WorkforceLog { id: string; agent: string; action: string; detail: string | null; at: string; campaignId: string | null }
export interface Workforce { agents: WorkforceAgent[]; log: WorkforceLog[] }

export const AGENT_LOOK: Record<string, { icon: LucideIcon; tint: string; ink: string }> = {
  strategist: { icon: ClipboardList, tint: '#f3e8ff', ink: '#9333ea' },
  audience: { icon: Users, tint: '#e0f2fe', ink: '#0369a1' },
  content: { icon: PenLine, tint: '#f3e8ff', ink: '#9333ea' },
  outreach: { icon: Send, tint: '#dff7e8', ink: '#16a34a' },
  followup: { icon: Repeat, tint: '#fef3c7', ink: '#b45309' },
  reply: { icon: MessageSquare, tint: '#ffeedd', ink: '#ea580c' },
};
export const AGENT_ICON_FALLBACK = BarChart3;

export function useWorkforce() {
  const [data, setData] = useState<Workforce | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/client-acquisition/workforce').then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: Workforce) => { if (live) setData(j); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  return { data, failed };
}

export default function AgentsPanel() {
  const { data, failed } = useWorkforce();
  const now = Date.now();

  return (
    <Card title="Your AI Workforce" right={<Link href="/client-acquisition/campaign-agents" className="acq-link">View all agents <ArrowRight size={13} /></Link>}>
      {failed && <EmptyState title="Couldn't load agent activity" body="Try refreshing the page." />}
      {!failed && !data && <div style={{ display: 'grid', gap: 18 }}>{WORKFORCE.map((a) => <Skeleton key={a.id} h={44} />)}</div>}
      {data && (
        <div>
          {data.agents.map((a) => {
            const look = AGENT_LOOK[a.id]; const Icon = look?.icon ?? AGENT_ICON_FALLBACK;
            return (
              <div key={a.id} className="acq-row" style={{ padding: '11px 0' }}>
                <span className="acq-stat-icon" style={{ background: look?.tint, color: look?.ink }}><Icon size={21} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 14.5 }}>{a.name}</p>
                  <p className="acq-sub" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.latest ? `${a.latest.action} · ${timeAgo(a.latest.at, now)}` : a.idle}>{a.latest ? a.latest.action : a.idle}</p>
                </div>
                <Pill label={a.active ? 'Active' : 'Idle'} />
                <div style={{ textAlign: 'right', minWidth: 74 }}>
                  <p style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>{a.week}</p>
                  <p className="acq-sub" style={{ fontSize: 12 }}>this week</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

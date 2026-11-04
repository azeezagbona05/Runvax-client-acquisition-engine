import type { ReactNode } from 'react';
import { Eye, Link2, Mail, MessageSquare, Send, Users } from 'lucide-react';
import type { Overview } from '@/lib/acqOverview';
import { Skeleton, fmtNum } from './ui';

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const down = pct < 0;
  return <span className={`acq-delta${down ? ' down' : ''}`}>{down ? '↓' : '↑'} {Math.abs(pct)}%</span>;
}

function Stat({ icon, tint, ink, label, value, beside, foot }: { icon: ReactNode; tint: string; ink: string; label: string; value: string; beside?: ReactNode; foot?: ReactNode }) {
  return (
    <div className="acq-card acq-stat">
      <span className="acq-stat-icon" style={{ background: tint, color: ink }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="acq-stat-label">{label}</p>
        <p style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span className="acq-stat-value">{value}</span>
          {beside}
        </p>
        {foot && <p className="acq-stat-foot">{foot}</p>}
      </div>
    </div>
  );
}

const pctText = (n: number) => <span className="acq-muted" style={{ fontSize: 12.5 }}>{n}%</span>;

export default function StatCards({ cards }: { cards: Overview['cards'] | null }) {
  if (!cards) {
    return (
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="acq-card acq-stat"><Skeleton h={46} w={46} r={12} /><div style={{ flex: 1, display: 'grid', gap: 8 }}><Skeleton h={10} w="50%" /><Skeleton h={22} w="70%" /></div></div>)}
      </div>
    );
  }
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      <Stat icon={<Users size={22} />} tint="#f3e8ff" ink="#9333ea" label="Total Leads" value={fmtNum(cards.totalLeads)} beside={<Delta pct={cards.leadsGrowthPct} />} foot={`+${fmtNum(cards.leadsThisWeek)} this week`} />
      <Stat icon={<Send size={22} />} tint="#e9d5ff" ink="#9333ea" label="Emails Sent" value={fmtNum(cards.emailsSent)} beside={<Delta pct={cards.sentGrowthPct} />} foot={`of ${fmtNum(cards.sentOfLeads)} leads`} />
      <Stat icon={<Mail size={22} />} tint="#e9d5ff" ink="#9333ea" label="Delivered" value={fmtNum(cards.delivered)} beside={cards.emailsSent ? pctText(cards.deliveredRate) : undefined} foot={<span title="Accepted by your mail server. Bounces after that are not tracked yet.">Delivery rate</span>} />
      <Stat icon={<Eye size={22} />} tint="#f3e8ff" ink="#9333ea" label="Opened" value={fmtNum(cards.opened)} beside={cards.delivered ? pctText(cards.openRate) : undefined} foot="of delivered" />
      <Stat icon={<Link2 size={22} />} tint="#e9d5ff" ink="#9333ea" label="Clicked" value={fmtNum(cards.clicked)} beside={cards.delivered ? pctText(cards.clickRate) : undefined} foot="of delivered" />
      <Stat icon={<MessageSquare size={22} />} tint="#f3e8ff" ink="#9333ea" label="Replies" value={fmtNum(cards.replies)} beside={cards.delivered ? pctText(cards.replyRate) : undefined}
        foot={<span style={{ color: '#16a34a', fontWeight: 600 }}>{fmtNum(cards.interested)} interested</span>} />
    </div>
  );
}

'use client';

import { AGENT_ICON_FALLBACK, AGENT_LOOK, useWorkforce } from '@/components/acq/AgentsPanel';
import { Card, EmptyState, Pill, Skeleton } from '@/components/acq/ui';
import { timeAgo } from '@/lib/acqOverview';
import { WORKFORCE } from '@/lib/workforce';

export default function AgentsPage() {
  const { data, failed } = useWorkforce();
  const now = Date.now();
  const names = Object.fromEntries(WORKFORCE.map((a) => [a.id, a.name]));

  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">AI Workforce</h1>
        <p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>Six agents, each with one job, working together through your campaigns. They plan, write, send and read replies; follow-ups wait for your click and nothing replies to a prospect without your approval.</p>
      </div>
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

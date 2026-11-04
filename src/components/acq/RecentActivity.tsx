import Link from 'next/link';
import { ArrowRight, Eye, Link2, Mail, MessageCircle, Send, UserPlus } from 'lucide-react';
import { timeAgo, type ActivityEvent, type ActivityType } from '@/lib/acqOverview';
import { Card, EmptyState, Pill } from './ui';

export const ACTIVITY_ICON: Record<ActivityType, { icon: typeof Mail; color: string }> = {
  sent: { icon: Mail, color: '#9333ea' },
  followup: { icon: Send, color: '#9333ea' },
  opened: { icon: Eye, color: '#9333ea' },
  clicked: { icon: Link2, color: '#9333ea' },
  replied: { icon: MessageCircle, color: '#16a34a' },
  imported: { icon: UserPlus, color: '#16a34a' },
};

export function ActivityRows({ events, now = Date.now() }: { events: ActivityEvent[]; now?: number }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="acq-table" style={{ minWidth: 640 }}>
        <tbody>
          {events.map((e) => {
            const { icon: Icon, color } = ACTIVITY_ICON[e.type];
            return (
              <tr key={e.id}>
                <td style={{ width: 34, paddingLeft: 4 }}><Icon size={17} style={{ color }} /></td>
                <td style={{ color: '#1e293b', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.text}</td>
                <td className="acq-muted" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.campaignName}</td>
                <td className="acq-muted" style={{ whiteSpace: 'nowrap' }}>{timeAgo(e.at, now)}</td>
                <td style={{ textAlign: 'right', paddingRight: 4 }}><Pill label={e.pill} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RecentActivity({ events }: { events: ActivityEvent[] }) {
  return (
    <Card title="Recent Activity" right={<Link href="/client-acquisition/activity" className="acq-link">View all activity <ArrowRight size={13} /></Link>}>
      {events.length === 0
        ? <EmptyState title="No activity yet" body="Imports, sends, opens, clicks and replies appear here as they happen." />
        : <ActivityRows events={events} />}
    </Card>
  );
}

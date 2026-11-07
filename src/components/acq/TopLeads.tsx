import Link from 'next/link';
import { ArrowRight, MoreHorizontal } from 'lucide-react';
import { timeAgoShort, type TopLead } from '@/lib/acqOverview';
import { BizLogo, Card, EmptyState, Pill } from './ui';

export default function TopLeads({ leads }: { leads: TopLead[] }) {
  return (
    <Card title="Top Leads by Engagement" right={<Link href="/client-acquisition/leads" className="acq-link">View all leads <ArrowRight size={13} /></Link>}>
      {leads.length === 0 ? (
        <EmptyState title="No engagement yet" body="Once people open, click or reply to your emails, the most engaged ones show up here." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="acq-table acq-rt" style={{ tableLayout: 'fixed', minWidth: 520 }}>
            <colgroup><col style={{ width: '28%' }} /><col style={{ width: '29%' }} /><col style={{ width: '17%' }} /><col style={{ width: '8%' }} /><col style={{ width: '14%' }} /><col style={{ width: '4%' }} /></colgroup>
            <thead><tr><th>Business</th><th>Email</th><th>Status</th><th>Opens</th><th>Last Activity</th><th /></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td data-primary style={{ overflow: 'hidden' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <BizLogo name={l.business} website={l.website} />
                      <span style={{ fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{l.business}</span>
                    </span>
                  </td>
                  <td data-wide className="acq-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.email}>{l.email}</td>
                  <td data-label="Status"><Pill label={l.status} /></td>
                  <td data-label="Opens">{l.opens}</td>
                  <td data-label="Last activity" className="acq-muted" style={{ whiteSpace: 'nowrap' }}>{timeAgoShort(l.lastActivityAt)}</td>
                  <td data-hide style={{ textAlign: 'right', paddingRight: 0, paddingLeft: 0 }}>
                    <Link href={`/client-acquisition/leads?q=${encodeURIComponent(l.email)}`} className="acq-icon-btn" aria-label={`Open ${l.business}`}><MoreHorizontal size={18} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

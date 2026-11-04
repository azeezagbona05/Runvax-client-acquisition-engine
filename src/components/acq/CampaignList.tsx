'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bot, Briefcase, Building2, GraduationCap, Mail, Monitor, Scale, Stethoscope, UtensilsCrossed,
} from 'lucide-react';
import type { CampaignRow } from '@/lib/acqOverview';
import { CAMPAIGN_STATUS_LABEL, Kebab, Pill, fmtDate, fmtNum } from './ui';

const THEMES: Array<{ re: RegExp; icon: typeof Mail; from: string; to: string }> = [
  { re: /web|site|design|develop/i, icon: Monitor, from: '#3b82f6', to: '#1e3a8a' },
  { re: /\bai\b|automat|bot|agent/i, icon: Bot, from: '#6366f1', to: '#312e81' },
  { re: /restaurant|food|cafe|bakery|catering|bar\b/i, icon: UtensilsCrossed, from: '#f59e0b', to: '#92400e' },
  { re: /dental|dentist|clinic|health|medical|doctor|vet/i, icon: Stethoscope, from: '#14b8a6', to: '#115e59' },
  { re: /law|legal|attorney/i, icon: Scale, from: '#64748b', to: '#1e293b' },
  { re: /school|education|academy|tutor/i, icon: GraduationCap, from: '#ec4899', to: '#831843' },
  { re: /hotel|real estate|estate|property|lodg/i, icon: Building2, from: '#0ea5e9', to: '#0c4a6e' },
  { re: /agency|consult|b2b|service/i, icon: Briefcase, from: '#8b5cf6', to: '#4c1d95' },
];
const FALLBACKS = [['#3b82f6', '#1e40af'], ['#8b5cf6', '#5b21b6'], ['#10b981', '#065f46'], ['#f97316', '#9a3412']];

/** A small tile in place of a photo: a topic icon on a gradient, chosen from the campaign's name. */
export function Thumb({ name }: { name: string }) {
  const theme = THEMES.find((t) => t.re.test(name));
  const h = Array.from(name).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 3);
  const [from, to] = theme ? [theme.from, theme.to] : FALLBACKS[h % FALLBACKS.length];
  const Icon = theme?.icon ?? Mail;
  return <span className="acq-thumb" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} aria-hidden><Icon size={24} /></span>;
}

interface Props {
  rows: CampaignRow[];
  limit?: number;
  /** Called after a pause/resume/delete so the page can refresh its numbers. */
  onChanged?: () => void;
}

export default function CampaignList({ rows, limit, onChanged }: Props) {
  const router = useRouter();
  const shown = limit ? rows.slice(0, limit) : rows;

  const act = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/outreach-campaigns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) window.alert(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'That did not work.');
    onChanged?.();
  };
  const remove = async (c: CampaignRow) => {
    if (!window.confirm(`Delete "${c.name}" and its history? This cannot be undone.`)) return;
    await fetch(`/api/outreach-campaigns/${c.id}`, { method: 'DELETE' });
    onChanged?.();
  };

  return (
    <div>
      {shown.map((c) => (
        <div key={c.id} className="acq-row" style={{ cursor: 'pointer' }} onClick={() => router.push(`/client-acquisition/campaigns/${c.id}`)}>
          <Thumb name={c.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <Link href={`/client-acquisition/campaigns/${c.id}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 700, fontSize: 14.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</Link>
                <p className="acq-sub" style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fmtNum(c.leads)} lead{c.leads === 1 ? '' : 's'} · {c.status === 'scheduled' && c.startedAt ? `Scheduled for ${fmtDate(c.startedAt)}` : c.startedAt ? `Started ${fmtDate(c.startedAt)}` : `Created ${fmtDate(c.createdAt)}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 20, textAlign: 'center', flex: 'none' }}>
                <div><p style={{ fontWeight: 700, fontSize: 15 }}>{fmtNum(c.sent)}</p><p className="acq-sub" style={{ fontSize: 12 }}>Sent</p></div>
                <div><p style={{ fontWeight: 700, fontSize: 15 }}>{c.openedPct}%</p><p className="acq-sub" style={{ fontSize: 12 }}>Opened</p></div>
                <div><p style={{ fontWeight: 700, fontSize: 15 }}>{c.repliedPct}%</p><p className="acq-sub" style={{ fontSize: 12 }}>Replied</p></div>
              </div>
            </div>
            <div className="acq-progress" style={{ marginTop: 10 }} role="progressbar" aria-valuenow={c.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.progressPct}% of the list emailed`}><i style={{ width: `${c.progressPct}%` }} /></div>
          </div>
          <div style={{ flex: 'none' }}><Pill label={CAMPAIGN_STATUS_LABEL[c.status] ?? c.status} /></div>
          <div onClick={(e) => e.stopPropagation()}>
            <Kebab
              label={`Actions for ${c.name}`}
              items={[
                { label: 'Open campaign', href: `/client-acquisition/campaigns/${c.id}` },
                { label: 'Edit campaign', href: `/client-acquisition/campaigns/${c.id}/edit` },
                ...(c.status === 'running' ? [{ label: 'Pause', onClick: () => void act(c.id, { action: 'pause' }) }] : []),
                { label: 'Delete', danger: true, onClick: () => void remove(c) },
              ]}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

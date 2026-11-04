'use client';

import { ShieldCheck } from 'lucide-react';
import { dayNumbers, type Automation } from '@/lib/automation';
import { CONVERSIONS, OBJECTIVES } from '@/lib/campaignBrief';
import type { TemplateConfig } from '@/lib/templateLibrary';
import { Card } from '../ui';

const hour12 = (h: number) => `${h % 12 || 12}:00 ${h % 24 < 12 ? 'AM' : 'PM'}`;
const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13.5 }}><span className="acq-sub">{k}</span><div>{children}</div></div>
);

/** The last screen before a campaign is created: everything it will do, with approval required. Nothing is sent from here. */
export default function CampaignReview({ tpl, auto, contactsCount, approved, setApproved }: {
  tpl: TemplateConfig; auto: Automation; contactsCount: number; approved: boolean; setApproved: (v: boolean) => void;
}) {
  const b = auto.brief;
  const days = dayNumbers(auto);
  const objective = OBJECTIVES.find((o) => o.id === (b?.objective ?? tpl.primaryObjective))?.label;
  const conversion = CONVERSIONS.find((c) => c.id === (b?.conversion ?? tpl.conversion))?.label;
  return (
    <Card title="Review and approve">
      <Row k="Objective">{objective}{b?.goal ? `: ${b.goal}` : ''} · Conversion: {conversion}</Row>
      <Row k="Target audience">{b?.audience || tpl.idealCustomer}{b?.market ? ` (${b.market})` : ''}</Row>
      <Row k="Selected contacts">{contactsCount ? `${contactsCount} contact${contactsCount === 1 ? '' : 's'} added in this session.` : 'None yet. You can add contacts on the campaign page before running it.'}</Row>
      <Row k="Message previews">
        <div style={{ display: 'grid', gap: 6 }}>{auto.emails.map((e, i) => (
          <details key={i}><summary style={{ cursor: 'pointer', fontWeight: 600 }}><span className="acq-pill acq-pill-purple" style={{ marginRight: 8 }}>Day {days[i]}</span>{e.subject}</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, color: '#334155', margin: '6px 0 0' }}>{e.body}</pre></details>))}</div>
      </Row>
      <Row k="Follow-up sequence">{auto.emails.length - 1} follow-up{auto.emails.length === 2 ? '' : 's'} on {days.slice(1).map((d) => `Day ${d}`).join(', ') || 'no days'}. {auto.stopOnReply ? 'They stop the moment someone replies, opts out or books.' : ''}</Row>
      <Row k="Sending channel">Email, from your own mailbox. Other channels are not switched on.</Row>
      <Row k="Schedule">Saved as a draft. Nothing is sent until you press Run. Intended window {hour12(auto.windowStart)} to {hour12(auto.windowEnd)}{auto.weekdaysOnly ? ', weekdays' : ''} (saved, not enforced yet). Follow-ups wait for your click.</Row>
      <Row k="Sending limits">At most {auto.dailyCap} a day for this campaign. A hard limit of 200 a day applies to your account.</Row>
      <Row k="Costs">RUNVAX adds no per-email charge. Your own mail provider&apos;s limits apply. Personalising first emails uses one AI call per contact from your daily AI allowance.</Row>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: 12, background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: 12, cursor: 'pointer', fontSize: 13.5 }}>
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} style={{ accentColor: '#9333ea', width: 18, height: 18, marginTop: 2 }} />
        <span><b>I have reviewed this campaign and approve it.</b> <span className="acq-sub">It is created as a draft. You still press Run to send, and you can edit anything first.</span></span>
      </label>
      <p className="acq-faint" style={{ fontSize: 12, marginTop: 8, display: 'flex', gap: 6 }}><ShieldCheck size={13} style={{ flex: 'none', marginTop: 1 }} />{tpl.contactNote}</p>
    </Card>
  );
}

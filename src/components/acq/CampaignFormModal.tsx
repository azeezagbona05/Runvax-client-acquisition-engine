'use client';

import { useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  DEFAULT_BODY, DEFAULT_DAILY_CAP, DEFAULT_FOLLOW_UP_BODY, DEFAULT_FOLLOW_UP_SUBJECT, DEFAULT_SUBJECT,
  HARD_DAILY_MAX, renderTemplate, type LeadInput,
} from '@/lib/outreachCampaign';
import LeadPicker from './LeadPicker';

export interface AddedSummary { added: number; duplicates: number; optedOut: number; invalid: number; overLimit: number }

export function describeAdded(a: AddedSummary): string {
  const parts = [`${a.added} added`];
  if (a.duplicates) parts.push(`${a.duplicates} already in this campaign`);
  if (a.optedOut) parts.push(`${a.optedOut} skipped because they unsubscribed before`);
  if (a.invalid) parts.push(`${a.invalid} invalid`);
  if (a.overLimit) parts.push(`${a.overLimit} over the list limit`);
  return parts.join(' · ');
}

export interface CampaignFull {
  id: string; name: string; subject: string; body: string;
  followUpSubject: string | null; followUpBody: string | null;
  followUpAfterDays: number; maxFollowUps: number; dailyCap: number;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'scheduled'; startedAt: string | null;
  /** The saved automation (sequence and campaign setup), when the campaign was built by the builder. */
  automation?: unknown;
}

export interface CampaignPreset { name?: string; subject?: string; body?: string; followUpSubject?: string; followUpBody?: string }

interface Props {
  /** Present when editing an existing campaign's wording; absent when creating one. */
  existing?: CampaignFull;
  /** Starting wording (from a template). */
  preset?: CampaignPreset;
  initialLeads?: LeadInput[];
  onClose: () => void;
  onSaved: (id: string, added?: AddedSummary | null) => void;
  /** Lets the page react to plan / verification errors from the server. */
  onGate?: (res: Response, json: { code?: string; error?: string; feature?: string }) => boolean | 'auth';
}

const TOKENS = ['{{name}}', '{{business}}', '{{website}}'];

export default function CampaignFormModal({ existing, preset, initialLeads, onClose, onSaved, onGate }: Props) {
  const [name, setName] = useState(existing?.name ?? preset?.name ?? '');
  const [leads, setLeads] = useState<LeadInput[]>(initialLeads ?? []);
  const [subject, setSubject] = useState(existing?.subject ?? preset?.subject ?? DEFAULT_SUBJECT);
  const [body, setBody] = useState(existing?.body ?? preset?.body ?? DEFAULT_BODY);
  const [followOn, setFollowOn] = useState(existing ? existing.maxFollowUps > 0 : true);
  const [followDays, setFollowDays] = useState(existing?.followUpAfterDays ?? 3);
  const [followSubject, setFollowSubject] = useState(existing?.followUpSubject ?? preset?.followUpSubject ?? DEFAULT_FOLLOW_UP_SUBJECT);
  const [followBody, setFollowBody] = useState(existing?.followUpBody ?? preset?.followUpBody ?? DEFAULT_FOLLOW_UP_BODY);
  const [cap, setCap] = useState(existing?.dailyCap ?? DEFAULT_DAILY_CAP);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const sample: LeadInput = leads[0] ?? { email: 'ada@example.com', name: 'Ada Obi', business: 'Bright Smile Dental' };
  const preview = useMemo(() => ({ subject: renderTemplate(subject, sample), body: renderTemplate(body, sample) }), [subject, body, sample]);

  const insertToken = (t: string) => {
    const el = bodyRef.current;
    if (!el) { setBody((b) => `${b}${t}`); return; }
    const { selectionStart: s, selectionEnd: e } = el;
    setBody(body.slice(0, s) + t + body.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + t.length, s + t.length); });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name, subject, body, dailyCap: cap,
        maxFollowUps: followOn ? 1 : 0, followUpAfterDays: followDays,
        followUpSubject: followOn ? followSubject : null, followUpBody: followOn ? followBody : null,
        ...(existing ? {} : { leads }),
      };
      const res = await fetch(existing ? `/api/outreach-campaigns/${existing.id}` : '/api/outreach-campaigns', {
        method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json() as { id?: string; added?: AddedSummary | null; error?: string; code?: string };
      if (onGate?.(res, json) === true) return;
      if (!res.ok) { setError(json.error ?? 'Could not save the campaign.'); return; }
      onSaved(existing?.id ?? json.id!, json.added);
    } catch {
      setError('Could not save the campaign. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const section = (title: string) => <p className="acq-label" style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 11 }}>{title}</p>;

  return (
    <div className="acq-modal-scrim" onMouseDown={onClose}>
      <div className="acq-modal" role="dialog" aria-modal="true" aria-label={existing ? 'Edit campaign' : 'New campaign'} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #eef2f8' }}>
          <h2 className="acq-title" style={{ fontSize: 18 }}>{existing ? 'Edit campaign' : 'New campaign'}</h2>
          <button className="acq-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ padding: 22, display: 'grid', gap: 24 }}>
          <div>
            <label className="acq-label" htmlFor="acq-name">Campaign name</label>
            <input id="acq-name" className="acq-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dental clinics, Lagos" maxLength={120} autoFocus={!existing} />
          </div>

          {!existing && <div>{section('Leads')}<LeadPicker leads={leads} onChange={setLeads} /></div>}

          <div style={{ display: 'grid', gap: 10 }}>
            {section('The email')}
            <input className="acq-input" aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" maxLength={190} />
            <textarea ref={bodyRef} className="acq-textarea" aria-label="Email body" rows={11} value={body} onChange={(e) => setBody(e.target.value)} />
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <span className="acq-faint" style={{ fontSize: 12 }}>Insert:</span>
              {TOKENS.map((t) => <button key={t} type="button" className="acq-btn acq-btn-sm" style={{ height: 26, padding: '0 8px', fontFamily: 'ui-monospace, monospace', color: '#9333ea' }} onClick={() => insertToken(t)}>{t}</button>)}
              <span className="acq-faint" style={{ fontSize: 12 }}>{'{{name}}'} is their first name (&ldquo;there&rdquo; if unknown).</span>
            </div>
            <div style={{ border: '1px solid #e6ebf3', background: '#f8fafc', borderRadius: 10, padding: 14 }}>
              <p className="acq-label" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Preview for {sample.business ?? sample.email}</p>
              <p style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>{preview.subject}</p>
              <p style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{preview.body}</p>
              <p className="acq-faint" style={{ fontSize: 12, marginTop: 10 }}>Your signature and an unsubscribe link are added to every email automatically. Links you include are click-tracked.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={followOn} onChange={(e) => setFollowOn(e.target.checked)} style={{ accentColor: '#9333ea', width: 16, height: 16 }} />
              Offer a follow-up to people who don&apos;t reply
            </label>
            {followOn && (
              <div style={{ display: 'grid', gap: 10, paddingLeft: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 13, color: '#475569' }}>
                  Mark as &ldquo;needs follow-up&rdquo; after
                  <select className="acq-select" aria-label="Days before follow-up" value={followDays} onChange={(e) => setFollowDays(Number(e.target.value))} style={{ width: 110, height: 34, padding: '4px 28px 4px 10px' }}>
                    {[2, 3, 4, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                  <span className="acq-faint" style={{ fontSize: 12 }}>You send it with one click; nothing goes out on its own.</span>
                </div>
                <input className="acq-input" aria-label="Follow-up subject" value={followSubject} onChange={(e) => setFollowSubject(e.target.value)} placeholder="Follow-up subject" />
                <textarea className="acq-textarea" aria-label="Follow-up email" rows={5} value={followBody} onChange={(e) => setFollowBody(e.target.value)} />
                <p className="acq-faint" style={{ fontSize: 12 }}>{'{{subject}}'} is the first email&apos;s subject; the follow-up lands in the same thread.</p>
              </div>
            )}
          </div>

          <div>
            <label className="acq-label" htmlFor="acq-cap">Send at most per day</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <input id="acq-cap" type="number" min={1} max={HARD_DAILY_MAX} className="acq-input" style={{ width: 104 }} value={cap} onChange={(e) => setCap(Math.max(1, Math.min(HARD_DAILY_MAX, Number(e.target.value) || 1)))} />
              <p className="acq-sub" style={{ fontSize: 12.5, lineHeight: 1.5 }}>Start with 20 to 30 a day. A new or rarely-used mailbox that suddenly sends hundreds gets flagged as spam. The maximum is {HARD_DAILY_MAX}.</p>
            </div>
          </div>

          {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{error}</p>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 22px', borderTop: '1px solid #eef2f8' }}>
          <p className="acq-faint" style={{ fontSize: 12.5 }}>{existing ? 'Changes apply to emails not yet sent.' : 'Creating a campaign sends nothing. You press Run when ready.'}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="acq-btn" onClick={onClose}>Cancel</button>
            <button className="acq-btn acq-btn-primary" onClick={() => void save()} disabled={saving || !name.trim() || !subject.trim() || !body.trim()}>
              {saving && <Loader2 size={16} className="animate-spin" />}
              {existing ? 'Save changes' : leads.length ? `Create with ${leads.length} lead${leads.length > 1 ? 's' : ''}` : 'Create campaign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

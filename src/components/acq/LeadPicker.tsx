'use client';

import { useMemo, useRef, useState } from 'react';
import { Upload, Users, X } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { recipientEmail } from '@/lib/decisionMaker';
import { MAX_LEADS_PER_CAMPAIGN, parseLeadCsv, type LeadInput } from '@/lib/outreachCampaign';

interface Props {
  leads: LeadInput[];
  onChange: (leads: LeadInput[]) => void;
}

const merge = (a: LeadInput[], b: LeadInput[]) => {
  const seen = new Set(a.map((l) => l.email));
  return [...a, ...b.filter((l) => !seen.has(l.email) && seen.add(l.email))];
};

/** Upload a CSV, paste addresses, or pull in saved prospects that have an email. Shows exactly what will be added. */
export default function LeadPicker({ leads, onChange }: Props) {
  const { prospects } = useProspects();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [rejected, setRejected] = useState<Array<{ line: number; raw: string; reason: string }>>([]);

  // Industry Acquisition clinics are contacted only through their own review queue, never from here.
  const fromProspects = useMemo<LeadInput[]>(() => prospects
    .filter((p) => p.source !== 'industry-acquisition')
    .map((p) => ({
      email: recipientEmail(p.business).trim().toLowerCase(),
      name: p.business.decisionMaker?.name,
      business: p.business.name,
      website: p.business.website,
    }))
    .filter((l) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(l.email)), [prospects]);

  const addText = (raw: string) => {
    const r = parseLeadCsv(raw);
    const next = merge(leads, r.leads).slice(0, MAX_LEADS_PER_CAMPAIGN);
    const added = next.length - leads.length;
    onChange(next);
    setRejected(r.rejected);
    const dupes = r.duplicates + (r.leads.length - added);
    setNote([`${added} added`, dupes ? `${dupes} duplicates ignored` : '', r.rejected.length ? `${r.rejected.length} rows skipped` : ''].filter(Boolean).join(' · '));
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) { setNote('That file is over 2 MB. Split it into smaller lists.'); return; }
    addText(await f.text());
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button type="button" className="acq-btn acq-btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Upload CSV</button>
        <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" style={{ display: 'none' }} onChange={(e) => void onFile(e.target.files?.[0])} />
        <button
          type="button" className="acq-btn acq-btn-sm" disabled={fromProspects.length === 0}
          title={fromProspects.length === 0 ? 'None of your saved prospects have an email yet' : undefined}
          onClick={() => { const next = merge(leads, fromProspects).slice(0, MAX_LEADS_PER_CAMPAIGN); setNote(`${next.length - leads.length} added from your prospects`); onChange(next); }}
        ><Users size={14} /> My prospects with an email ({fromProspects.length})</button>
        <span className="acq-faint" style={{ fontSize: 12 }}>Columns: email, name, business, website. Only email is required.</span>
      </div>

      <div>
        <textarea className="acq-textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
          placeholder={'Or paste here, one per line:\nada@brightsmile.com, Ada Obi, Bright Smile Dental'} />
        <button type="button" className="acq-btn acq-btn-primary acq-btn-sm" style={{ marginTop: 8 }} disabled={!text.trim()} onClick={() => { addText(text); setText(''); }}>Add pasted leads</button>
      </div>

      {note && <p style={{ fontSize: 13, color: '#334155' }}>{note}</p>}
      {rejected.length > 0 && (
        <details style={{ fontSize: 12.5, color: '#92520a' }}>
          <summary style={{ cursor: 'pointer' }}>Why {rejected.length} row{rejected.length > 1 ? 's were' : ' was'} skipped</summary>
          <ul className="acq-sub" style={{ margin: '6px 0 0', paddingLeft: 18, maxHeight: 110, overflow: 'auto' }}>
            {rejected.slice(0, 50).map((r) => <li key={r.line}>Line {r.line}: {r.reason}</li>)}
          </ul>
        </details>
      )}

      {leads.length > 0 && (
        <div style={{ border: '1px solid #e6ebf3', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #eef2f8' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{leads.length} lead{leads.length > 1 ? 's' : ''} ready</span>
            <button type="button" className="acq-link" style={{ color: '#64748b' }} onClick={() => { onChange([]); setNote(''); setRejected([]); }}>Clear all</button>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 160, overflow: 'auto' }}>
            {leads.slice(0, 100).map((l) => (
              <li key={l.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 12px', fontSize: 13, borderTop: '1px solid #f3f6fa' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b style={{ fontWeight: 600 }}>{l.email}</b>
                  {(l.name || l.business) && <span className="acq-muted"> · {[l.name, l.business].filter(Boolean).join(' · ')}</span>}
                </span>
                <button type="button" className="acq-icon-btn" style={{ width: 24, height: 24 }} aria-label={`Remove ${l.email}`} onClick={() => onChange(leads.filter((x) => x.email !== l.email))}><X size={13} /></button>
              </li>
            ))}
            {leads.length > 100 && <li className="acq-sub" style={{ padding: '6px 12px', fontSize: 12 }}>…and {leads.length - 100} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

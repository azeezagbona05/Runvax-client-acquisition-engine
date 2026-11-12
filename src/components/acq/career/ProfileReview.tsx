'use client';

import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { CareerProfileData } from '@/lib/career/types';
import { Field, box, fromLines, hint, lines } from './shared';

/** The candidate reviews what was read from the CV. Everything here is editable; confirming marks it as the verified source of truth. */
export default function ProfileReview({ profile, source, confirmed, removed, busy, onSave }: {
  profile: CareerProfileData; source: string | null; confirmed: boolean; removed: string[]; busy: boolean;
  onSave: (p: CareerProfileData, confirm: boolean) => void;
}) {
  const [p, setP] = useState<CareerProfileData>(profile); const [dirty, setDirty] = useState(false); const [skillsText, setSkillsText] = useState(profile.skills.join(', '));
  const set = (patch: Partial<CareerProfileData>) => { setP({ ...p, ...patch }); setDirty(true); };
  const role = (i: number, patch: Partial<CareerProfileData['experience'][number]>) => set({ experience: p.experience.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const edu = (i: number, patch: Partial<CareerProfileData['education'][number]>) => set({ education: p.education.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const empty = !p.experience.length && !p.education.length && !p.skills.length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="acq-notice" role="note" style={{ fontSize: 13 }}>
        <b>Your profile is the source of truth.</b> The agent writes CVs, letters and answers only from what is confirmed here. It never invents experience or qualifications.
        {source === 'rules' && ' The basic reader was used, so check every section carefully.'}
        {empty && ' Nothing could be read automatically, so please fill in what you want the agent to use.'}
      </div>
      {removed.length > 0 && <div style={{ ...box, background: '#fffbeb', borderColor: '#fde68a', fontSize: 12.5 }}><b>{removed.length} item(s) were left out</b> because they could not be found in your CV:<ul style={{ margin: '6px 0 0 18px' }}>{removed.slice(0, 6).map((r) => <li key={r}>{r}</li>)}</ul></div>}

      <div className="acq-setup-grid" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <Field label="Full name"><input className="acq-input" value={p.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Email"><input className="acq-input" value={p.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="Phone"><input className="acq-input" value={p.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Location"><input className="acq-input" value={p.location} onChange={(e) => set({ location: e.target.value })} /></Field>
      </div>
      <Field label="Headline"><input className="acq-input" value={p.headline} onChange={(e) => set({ headline: e.target.value })} placeholder="e.g. Frontend Developer" /></Field>
      <Field label="Summary"><textarea className="acq-input" rows={3} value={p.summary} onChange={(e) => set({ summary: e.target.value })} /></Field>

      <div style={{ display: 'grid', gap: 8 }}>
        <b style={{ fontSize: 14 }}>Experience</b>
        {p.experience.map((r, i) => (
          <div key={i} style={{ ...box, display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
              <input className="acq-input" aria-label="Job title" placeholder="Job title" value={r.title} onChange={(e) => role(i, { title: e.target.value })} />
              <input className="acq-input" aria-label="Company" placeholder="Company" value={r.company} onChange={(e) => role(i, { company: e.target.value })} />
              <input className="acq-input" aria-label="Start" placeholder="Start" value={r.start} onChange={(e) => role(i, { start: e.target.value })} />
              <input className="acq-input" aria-label="End" placeholder="End" value={r.end} onChange={(e) => role(i, { end: e.target.value })} />
            </div>
            <textarea className="acq-input" rows={3} aria-label="What you did (one per line)" placeholder="What you did, one per line" value={lines(r.bullets)} onChange={(e) => role(i, { bullets: e.target.value.split('\n') })} />
            <button type="button" className="acq-btn acq-btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ experience: p.experience.filter((_, j) => j !== i) })}><Trash2 size={13} /> Remove role</button>
          </div>
        ))}
        <button type="button" className="acq-btn acq-btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ experience: [...p.experience, { title: '', company: '', start: '', end: '', location: '', bullets: [] }] })}><Plus size={13} /> Add a role</button>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <b style={{ fontSize: 14 }}>Education</b>
        {p.education.map((e, i) => (
          <div key={i} style={{ ...box, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
            <input className="acq-input" aria-label="Qualification" placeholder="Qualification" value={e.qualification} onChange={(ev) => edu(i, { qualification: ev.target.value })} />
            <input className="acq-input" aria-label="Institution" placeholder="Institution" value={e.institution} onChange={(ev) => edu(i, { institution: ev.target.value })} />
            <input className="acq-input" aria-label="Year" placeholder="Year" value={e.end} onChange={(ev) => edu(i, { end: ev.target.value })} />
            <button type="button" className="acq-btn acq-btn-sm" onClick={() => set({ education: p.education.filter((_, j) => j !== i) })}><Trash2 size={13} /> Remove</button>
          </div>
        ))}
        <button type="button" className="acq-btn acq-btn-sm" style={{ justifySelf: 'start' }} onClick={() => set({ education: [...p.education, { institution: '', qualification: '', start: '', end: '' }] })}><Plus size={13} /> Add education</button>
      </div>

      <Field label="Skills" hint="Separate with commas or new lines."><textarea className="acq-input" rows={2} value={skillsText} onChange={(e) => { setSkillsText(e.target.value); set({ skills: fromLines(e.target.value) }); }} /></Field>
      <Field label="Certifications" hint="One per line."><textarea className="acq-input" rows={2} value={lines(p.certifications)} onChange={(e) => set({ certifications: e.target.value.split('\n') })} /></Field>
      <Field label="Achievements" hint="One per line. Only things that are true and that you can back up."><textarea className="acq-input" rows={3} value={lines(p.achievements)} onChange={(e) => set({ achievements: e.target.value.split('\n') })} /></Field>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="acq-btn acq-btn-primary" disabled={busy || empty} onClick={() => { onSave(p, true); setDirty(false); }}><Check size={15} /> {confirmed && !dirty ? 'Confirmed' : 'Confirm this is accurate'}</button>
        {dirty && <button type="button" className="acq-btn" disabled={busy} onClick={() => { onSave(p, false); setDirty(false); }}>Save without confirming</button>}
        <span style={hint}>{confirmed && !dirty ? 'The agent may use this profile.' : 'Not confirmed yet. The agent will not use it until you confirm.'}</span>
      </div>
    </div>
  );
}
